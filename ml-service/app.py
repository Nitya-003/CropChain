import os
import io
import base64
import numpy as np
import joblib
from functools import wraps
from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from PIL import Image

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


def analyze_crop_image(pil_image):
    """
    Computer Vision Analysis for crop leaf health & quality assessment.
    Calculates RGB channel distribution, greenness index, and brown spot necrosis.
    """
    img = pil_image.convert("RGB").resize((224, 224))
    arr = np.array(img, dtype=np.float32) / 255.0

    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    
    # Calculate Vegetation Greenness Index (ExG = 2*G - R - B)
    exg = 2.0 * g - r - b
    mean_exg = float(np.mean(exg))
    
    # Calculate Necrosis / Brown spot index (high red & green, low blue with high variance)
    brown_spots = np.logical_and(np.logical_and(r > 0.4, g > 0.2), b < 0.3)
    spot_ratio = float(np.sum(brown_spots) / (224 * 224))

    # Disease classification rules
    if spot_ratio < 0.05 and mean_exg > 0.1:
        diagnosis = "Healthy"
        disease_detected = False
        confidence = round(90.0 + min(mean_exg * 20.0, 9.5), 1)
        freshness_score = round(95.0 - spot_ratio * 100.0, 1)
        quality_grade = "A+" if freshness_score >= 90.0 else "A"
    elif spot_ratio >= 0.05 and spot_ratio < 0.15:
        diagnosis = "Early Blight / Bacterial Spot"
        disease_detected = True
        confidence = round(85.0 + spot_ratio * 50.0, 1)
        freshness_score = round(80.0 - spot_ratio * 120.0, 1)
        quality_grade = "B"
    elif spot_ratio >= 0.15 and spot_ratio < 0.30:
        diagnosis = "Late Blight / Leaf Mold"
        disease_detected = True
        confidence = round(88.0 + spot_ratio * 30.0, 1)
        freshness_score = round(65.0 - spot_ratio * 100.0, 1)
        quality_grade = "C"
    else:
        diagnosis = "Severe Necrosis / Yellow Leaf Curl"
        disease_detected = True
        confidence = 94.0
        freshness_score = round(max(30.0 - spot_ratio * 50.0, 5.0), 1)
        quality_grade = "Defective"

    return {
        "diagnosis": diagnosis,
        "confidence": confidence,
        "freshness_score": freshness_score,
        "quality_grade": quality_grade,
        "disease_detected": disease_detected,
        "details": {
            "greenness_index": round(mean_exg, 4),
            "spot_ratio": round(spot_ratio, 4)
        }
    }


@app.route("/health", methods=["GET"])
@require_api_key
def health():
    return jsonify({"status": "ok", "crops": list(model.classes_), "vision_supported": True})


@app.route("/predict-yield", methods=["POST"])
@require_api_key
@limiter.limit(os.environ.get("ML_RATE_LIMIT_PREDICT", "10 per second"))
def predict_yield():
    """
    Predicts the expected harvest volume (yield) for logistics planning.
    Expects JSON: { "crop": "wheat", "area_hectares": 10.5, "avg_temperature": 24, "expected_rainfall": 120 }
    """
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "Request body must be JSON"}), 400

    crop = body.get("crop", "unknown")
    area = float(body.get("area_hectares", 0))
    temp = float(body.get("avg_temperature", 25))
    rainfall = float(body.get("expected_rainfall", 100))

    if area <= 0:
        return jsonify({"error": "area_hectares must be > 0"}), 422

    # Mock Yield Model Calculation:
    # Base yield per hectare depends on crop, adjusted by weather factors.
    # In a real scenario, this would load a separate TensorFlow/XGBoost model.
    base_yield_per_hectare = 3.5  # tons
    
    # Simple modifier based on optimal weather (mock logic)
    temp_modifier = 1.0 - (abs(temp - 25) * 0.02)
    rain_modifier = 1.0 - (abs(rainfall - 100) * 0.005)
    
    expected_yield = area * base_yield_per_hectare * temp_modifier * rain_modifier
    expected_yield = max(0, round(expected_yield, 2))

    return jsonify({
        "crop": crop,
        "area_hectares": area,
        "expected_yield_tons": expected_yield,
        "logistics_status": "Ready for planning",
        "confidence": 85.5
    })


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


@app.route("/predict-image", methods=["POST"])
@require_api_key
@limiter.limit(os.environ.get("ML_RATE_LIMIT_PREDICT_IMAGE", "10 per second"))
def predict_image():
    """
    Computer Vision Endpoint for crop leaf disease detection & produce quality assessment.
    Accepts multipart/form-data ('image' or 'file') or JSON base64 ('image_base64').
    """
    try:
        pil_img = None

        # 1. Try multipart file upload
        if "file" in request.files:
            file = request.files["file"]
            pil_img = Image.open(file.stream)
        elif "image" in request.files:
            file = request.files["image"]
            pil_img = Image.open(file.stream)
        else:
            # 2. Try JSON base64 string
            body = request.get_json(silent=True)
            if body:
                b64_str = body.get("image_base64") or body.get("image")
                if b64_str:
                    if "," in b64_str:
                        b64_str = b64_str.split(",")[1]
                    img_bytes = base64.b64decode(b64_str)
                    pil_img = Image.open(io.BytesIO(img_bytes))

        if pil_img is None:
            return jsonify({
                "error": "No image payload provided",
                "details": "Send multipart/form-data with key 'image' or JSON with 'image_base64'"
            }), 400

        res = analyze_crop_image(pil_img)
        return jsonify(res), 200

    except Exception as e:
        return jsonify({"error": "Failed to process image payload", "details": str(e)}), 422


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)

