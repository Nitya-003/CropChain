import pytest
from weather_pipeline import predict_yield_loss

def test_predict_yield_loss_stable():
    payload = {
        "temp_max": 28.0,
        "temp_min": 18.0,
        "rainfall_forecast": 50.0,
        "historical_avg_rainfall": 50.0,
        "crop_type": "Wheat",
        "growth_stage": "Vegetative"
    }
    res = predict_yield_loss(payload)
    assert res["success"] is True
    assert res["risk_tier"] == "Low"
    assert 0.0 <= res["yield_loss_risk_pct"] <= 100.0

def test_predict_yield_loss_heatwave_and_drought():
    payload = {
        "temp_max": 42.0,
        "temp_min": 28.0,
        "rainfall_forecast": 5.0,
        "historical_avg_rainfall": 60.0,
        "crop_type": "Rice",
        "growth_stage": "Flowering"
    }
    res = predict_yield_loss(payload)
    assert res["success"] is True
    assert res["risk_tier"] in ["High", "Severe"]
    assert "Extreme Heatwave (High Transpiration Risk)" in res["anomalies"]
    assert "Severe Monsoon Drought Deficit" in res["anomalies"]

if __name__ == "__main__":
    test_predict_yield_loss_stable()
    test_predict_yield_loss_heatwave_and_drought()
    print("[PASS] All weather pipeline Python tests passed cleanly!")
