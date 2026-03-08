"""
Crop Recommendation Flask API

Loads (or trains) a RandomForest model and exposes two endpoints:

  GET  /health   → liveness probe
  POST /predict  → returns top crop + confidence + alternatives
"""

import os
import numpy as np
import joblib
from flask import Flask, request, jsonify

app = Flask(__name__)

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


@app.route("/health", methods=["GET"])
def health():
    return jsonify({"status": "ok", "crops": list(model.classes_)})


@app.route("/predict", methods=["POST"])
def predict():
    body = request.get_json(silent=True)
    if not body:
        return jsonify({"error": "Request body must be JSON"}), 400

    # --- parse & validate ---
    features = []
    for field in REQUIRED_FIELDS:
        if field not in body:
            return jsonify({"error": f"Missing field: '{field}'"}), 400
        try:
            val = float(body[field])
        except (TypeError, ValueError):
            return jsonify({"error": f"Field '{field}' must be a number"}), 400

        lo, hi = BOUNDS[field]
        if not (lo <= val <= hi):
            return jsonify(
                {"error": f"'{field}' must be between {lo} and {hi}, got {val}"}
            ), 400
        features.append(val)

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


if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5001))
    app.run(host="0.0.0.0", port=port, debug=False)
