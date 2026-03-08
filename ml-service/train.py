"""
Crop Recommendation Model — Training Script

Generates synthetic training data based on well-known soil/climate profiles for
22 crops (matching the public Crop Recommendation Dataset distributions), then
trains a RandomForestClassifier and saves it as model.joblib.

Run once before starting the Flask API, or the API will run this automatically
if model.joblib is missing.
"""

import os
import numpy as np
import joblib
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, classification_report

np.random.seed(42)

# Each entry: [N_mean, P_mean, K_mean, pH_mean, temp_mean, humidity_mean, rainfall_mean,
#              N_std,  P_std,  K_std,  pH_std,  temp_std,  humidity_std,  rainfall_std]
CROP_PROFILES = {
    "rice":        [79,  47,  40,  6.50, 23.7, 82.0, 236.2, 10, 8,  8,  0.5, 2.0, 4.0, 30.0],
    "maize":       [77,  48,  20,  6.00, 22.6, 65.0,  85.0, 10, 8,  6,  0.5, 2.0, 5.0, 15.0],
    "chickpea":    [40,  68,  79,  7.50, 18.0, 16.0,  80.4,  8, 10, 10, 0.3, 2.0, 3.0, 12.0],
    "kidneybeans": [21,  68,  20,  5.70, 20.1, 21.0, 105.9,  6, 10,  6, 0.4, 2.0, 3.0, 15.0],
    "pigeonpeas":  [21,  68,  20,  5.80, 27.7, 48.0, 149.5,  6, 10,  6, 0.4, 2.0, 5.0, 20.0],
    "mothbeans":   [21,  48,  20,  6.90, 28.2, 53.0,  51.2,  6,  8,  6, 0.5, 2.0, 5.0, 10.0],
    "mungbean":    [21,  48,  19,  6.73, 28.5, 85.5,  48.4,  6,  8,  6, 0.5, 2.0, 4.0,  8.0],
    "blackgram":   [40,  68,  19,  7.13, 29.0, 64.9,  70.3,  8, 10,  6, 0.4, 2.0, 4.0, 10.0],
    "lentil":      [19,  68,  19,  6.93, 24.5, 64.8,  45.7,  5, 10,  5, 0.5, 2.0, 5.0,  8.0],
    "pomegranate": [19,  19,  40,  5.93, 21.8, 90.1, 107.5,  5,  5,  8, 0.4, 2.0, 4.0, 15.0],
    "banana":      [100, 82,  50,  6.00, 27.4, 80.4, 104.6, 15, 12, 10, 0.4, 2.0, 4.0, 15.0],
    "mango":       [20,  20,  30,  5.77, 31.3, 50.2,  94.7,  5,  5,  8, 0.4, 2.0, 4.0, 15.0],
    "grapes":      [23, 133, 200,  6.12, 23.9, 81.7,  68.9,  5, 15, 20, 0.4, 2.0, 4.0, 12.0],
    "watermelon":  [100, 10,  50,  6.50, 25.6, 85.2,  50.8, 12,  4, 10, 0.4, 2.0, 4.0,  8.0],
    "muskmelon":   [100, 10,  50,  6.50, 28.7, 92.3,  24.7, 12,  4, 10, 0.4, 2.0, 3.0,  5.0],
    "apple":       [21, 134, 200,  5.93, 21.9, 92.4, 112.7,  5, 15, 20, 0.4, 2.0, 3.0, 15.0],
    "orange":      [19,  16,  10,  7.02, 22.8, 92.2, 110.3,  5,  5,  4, 0.4, 2.0, 3.0, 15.0],
    "papaya":      [50,  59,  50,  6.55, 33.7, 92.3, 143.4,  8, 10, 10, 0.4, 2.0, 3.0, 20.0],
    "coconut":     [21,  16,  30,  5.95, 27.4, 94.8, 175.7,  5,  5,  8, 0.4, 2.0, 3.0, 25.0],
    "cotton":      [117, 46,  19,  6.92, 23.7, 79.6,  80.9, 15,  8,  6, 0.4, 2.0, 4.0, 12.0],
    "jute":        [78,  46,  40,  6.73, 24.9, 79.6, 174.8, 10,  8,  8, 0.4, 2.0, 4.0, 25.0],
    "coffee":      [101, 28,  29,  5.93, 25.5, 58.9, 158.0, 15,  6,  6, 0.4, 2.0, 5.0, 25.0],
}

SAMPLES_PER_CROP = 100  # 2 200 total — matches dataset scale


def generate_dataset():
    X, y = [], []
    for crop, params in CROP_PROFILES.items():
        means, stds = params[:7], params[7:]
        for _ in range(SAMPLES_PER_CROP):
            sample = [max(0.0, np.random.normal(m, s)) for m, s in zip(means, stds)]
            sample[3] = float(np.clip(sample[3], 3.5, 9.5))   # pH bounds
            sample[5] = float(np.clip(sample[5], 0.0, 100.0)) # humidity bounds
            X.append(sample)
            y.append(crop)
    return np.array(X, dtype=np.float32), np.array(y)


def train_and_save(model_path: str):
    print("Generating synthetic training data …")
    X, y = generate_dataset()

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    print(f"Training RandomForestClassifier on {len(X_train)} samples …")
    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=None,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)

    accuracy = accuracy_score(y_test, model.predict(X_test))
    print(f"Test-set accuracy: {accuracy:.4f}")
    print(classification_report(y_test, model.predict(X_test)))

    joblib.dump(model, model_path)
    print(f"Model saved → {model_path}")
    return model


if __name__ == "__main__":
    out_path = os.path.join(os.path.dirname(__file__), "model.joblib")
    train_and_save(out_path)
