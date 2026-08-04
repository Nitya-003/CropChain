"""
Crop Recommendation Flask API

Loads (or trains) a RandomForest model and exposes two endpoints:

  GET  /health   → liveness probe
  POST /predict  → returns top crop + confidence + alternatives

Security:
  - API key authentication via X-API-Key header
  - Rate limiting (100/min default, 10/s on /predict)
  - CORS restricted to the main backend
  - Input validation with agronomic bounds
"""

import os
import numpy as np
import joblib
from functools import wraps
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

app = Flask(__name__)

# ── CORS: only allow the main backend ──────────────────────────────────────
ALLOWED_ORIGIN = os.environ.get("CORS_ORIGIN", "http://localhost:3001")
CORS(app, origins=[ALLOWED_ORIGIN])

# ── Rate limiting ──────────────────────────────────────────────────────────
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=[os.environ.get("ML_RATE_LIMIT_DEFAULT", "100 per minute")],
)

# ── API key authentication ─────────────────────────────────────────────────
API_KEY = os.environ.get("ML_API_KEY", "change-me-in-production")


def require_api_key(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        api_key = request.headers.get("X-API-Key")
        if not api_key or api_key != API_KEY:
            return jsonify({"error": "Unauthorized"}), 401
        return f(*args, **kwargs)
    return decorated


MODEL_PATH = os.path.join(os.path.dirname(__file__), "model.joblib")

# ── Bootstrap model if missing ──────────────────────────────────────────────
if not os.path.exists(MODEL_PATH):
    print("[ml-service] model.joblib not found — running training script …")
    from train import train_and_save
    train_and_save(MODEL_PATH)

model = joblib.load(MODEL_PATH)
print(f"[ml-service] Model loaded ({len(model.classes_)} classes).")

REQUIRED_FIELDS = ["N", "P", "K", "pH", "temperature", "humidity", "rainfall"]

# ── Validation bounds (mirrors Joi schema in Node backend) ───────────────────
BOUNDS = {
    "N":           (0,   140),
    "P":           (5,   145),
    "K":           (5,   205),
    "pH":          (3.5,  9.5),
    "temperature": (0,    50),
    "humidity":    (10,  100),
    "rainfall":    (0,   300),
}


def validate_input(data):
    errors = []
    for field, (lo, hi) in BOUNDS.items():
        if field not in data:
            errors.append(f"'{field}' is required")
            continue
        try:
            val = float(data[field])
        except (TypeError, ValueError):
            errors.append(f"'{field}' must be a number")
            continue
        if not (lo <= val <= hi):
            errors.append(f"'{field}' must be between {lo} and {hi}, got {val}")
    return errors


@app.route("/health", methods=["GET"])
@require_api_key
def health():
    return jsonify({"status": "ok", "crops": list(model.classes_)})


@app.route("/predict", methods=["POST"])
@require_api_key
@limiter.limit(os.environ.get("ML_RATE_LIMIT_PREDICT", "10 per second"))
def predict():
    body = request.get_json(silent=True)
    if body is None:
        return jsonify({"error": "Request body must be JSON"}), 400

    validation_errors = validate_input(body)
    if validation_errors:
        return jsonify({"error": "Validation failed", "details": validation_errors}), 422

    features = [float(body[f]) for f in REQUIRED_FIELDS]

    # --- predict ---
    X = np.array([features], dtype=np.float32)
    proba = model.predict_proba(X)[0]
    classes = model.classes_

    top_indices = np.argsort(proba)[::-1]
    top_crop = classes[top_indices[0]]
    confidence = round(float(proba[top_indices[0]]) * 100, 1)

    alternatives = [
        {"crop": classes[i], "confidence": round(float(proba[i]) * 100, 1)}
        for i in top_indices[1:4]
    ]

    return jsonify({
        "crop": top_crop,
        "confidence": confidence,
        "alternatives": alternatives,
    })


@app.route("/quality", methods=["POST"])
@require_api_key
@limiter.limit(os.environ.get("ML_RATE_LIMIT_PREDICT", "10 per second"))
def predict_quality():
    body = request.get_json(silent=True)
    if body is None:
        return jsonify({"error": "Request body must be JSON"}), 400

    crop = body.get("cropType", "unknown").lower()
    temp = body.get("temperature")
    humidity = body.get("humidity")
    
    if temp is None or humidity is None:
        return jsonify({"error": "Validation failed", "details": ["'temperature' and 'humidity' are required"]}), 422
        
    try:
        temp = float(temp)
        humidity = float(humidity)
    except (TypeError, ValueError):
        return jsonify({"error": "Validation failed", "details": ["'temperature' and 'humidity' must be numbers"]}), 422

    optimal_conditions = {
        "tomato": {"temp": 25, "hum": 60, "shelf": 14},
        "wheat": {"temp": 20, "hum": 40, "shelf": 180},
        "rice": {"temp": 25, "hum": 50, "shelf": 180},
        "corn": {"temp": 22, "hum": 45, "shelf": 90}
    }
    
    default_optimal = {"temp": 22, "hum": 50, "shelf": 30}
    optimal = optimal_conditions.get(crop, default_optimal)
    
    temp_penalty = max(0, temp - optimal["temp"]) * 1.5 + max(0, optimal["temp"] - 10 - temp) * 0.5
    hum_penalty = max(0, humidity - optimal["hum"]) * 1.0
    
    quality_score = max(0, min(100, 100 - (temp_penalty + hum_penalty)))
    risk_score = max(0, min(100, 100 - quality_score))
    
    risk_level = "Low"
    if risk_score > 60:
        risk_level = "High"
    elif risk_score > 25:
        risk_level = "Medium"
        
    factors = []
    if temp > optimal["temp"] + 5:
        factors.append(f"Temperature is significantly higher than optimal ({optimal['temp']}°C).")
    if humidity > optimal["hum"] + 10:
        factors.append(f"Humidity is significantly higher than optimal ({optimal['hum']}%).")
        
    if not factors and risk_level != "Low":
        factors.append("Sub-optimal environmental conditions.")
        
    shelf_life = max(0, optimal["shelf"] * (quality_score / 100))
    
    return jsonify({
        "riskScore": round(risk_score, 1),
        "riskLevel": risk_level,
        "factors": factors,
        "estimatedShelfLifeDays": round(shelf_life, 1)
    })



if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)
