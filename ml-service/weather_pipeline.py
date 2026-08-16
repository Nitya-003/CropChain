"""
AI Weather Anomaly & Crop Yield Loss Prediction Pipeline
Calculates crop yield loss risk percentage (0-100%) and identifies meteorological anomalies
such as Unseasonal Monsoons, Extreme Drought, and Heatwaves based on 14-day weather forecasts.
"""

def predict_yield_loss(data):
    try:
        temp_max = float(data.get("temp_max", 30.0))
        temp_min = float(data.get("temp_min", 20.0))
        rainfall_forecast = float(data.get("rainfall_forecast", 50.0))
        historical_avg_rainfall = float(data.get("historical_avg_rainfall", 50.0))
        crop_type = str(data.get("crop_type", "Rice")).capitalize()
        growth_stage = str(data.get("growth_stage", "Flowering")).capitalize()

        anomalies = []
        base_risk = 5.0  # Base baseline risk %

        # 1. Temperature Anomaly Check
        temp_diff = temp_max - 35.0
        if temp_diff > 0:
            base_risk += temp_diff * 4.5
            anomalies.append("Extreme Heatwave (High Transpiration Risk)")

        # 2. Rainfall Anomaly Check (Drought vs Flood)
        rain_diff = rainfall_forecast - historical_avg_rainfall
        if rainfall_forecast < 0.3 * historical_avg_rainfall:
            base_risk += 35.0
            anomalies.append("Severe Monsoon Drought Deficit")
        elif rainfall_forecast > 2.5 * historical_avg_rainfall:
            base_risk += 40.0
            anomalies.append("Unseasonal Monsoon Heavy Downpour & Waterlogging")

        # 3. Growth Stage Sensitivity Multiplier
        sensitivity = 1.0
        if growth_stage in ["Flowering", "Harvesting", "Grain filling"]:
            sensitivity = 1.4
            base_risk *= sensitivity

        # Clamp yield loss risk percentage between 0% and 95%
        yield_loss_pct = round(min(max(base_risk, 2.0), 95.0), 1)

        # Risk Tier Classification
        if yield_loss_pct >= 60.0:
            risk_tier = "Severe"
        elif yield_loss_pct >= 35.0:
            risk_tier = "High"
        elif yield_loss_pct >= 15.0:
            risk_tier = "Moderate"
        else:
            risk_tier = "Low"

        # Mitigation Recommendations
        recommendations = []
        if "Extreme Heatwave (High Transpiration Risk)" in anomalies:
            recommendations.append("Apply shade nets and increase drip irrigation frequency during peak hours.")
        if "Severe Monsoon Drought Deficit" in anomalies:
            recommendations.append("Utilize stored rainwater harvesting inventory and apply mulching to retain soil moisture.")
        if "Unseasonal Monsoon Heavy Downpour & Waterlogging" in anomalies:
            recommendations.append("Construct field drainage ditches immediately to prevent root rot and anaerobic soil decay.")

        if not recommendations:
            recommendations.append("Maintain standard irrigation and fertilization schedule for optimal yield.")

        return {
            "success": True,
            "crop_type": crop_type,
            "growth_stage": growth_stage,
            "yield_loss_risk_pct": yield_loss_pct,
            "risk_tier": risk_tier,
            "anomalies": anomalies if anomalies else ["None (Stable Microclimate)"],
            "recommendations": recommendations,
            "estimated_harvest_reduction_kg_per_acre": round(yield_loss_pct * 15.0, 1),
        }
    except Exception as e:
        return {"success": False, "error": str(e)}
