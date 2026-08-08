import os
import cv2
import numpy as np
import boto3
from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from botocore.exceptions import NoCredentialsError

# Note: In a production environment, you would ensure AWS credentials are set
# and the boto3 client is initialized properly.

drone_pipeline = Blueprint('drone_pipeline', __name__)

S3_BUCKET = os.environ.get('AWS_S3_BUCKET', 'cropchain-drone-imagery-mock')
UPLOAD_FOLDER = '/tmp/drone_uploads'

if not os.path.exists(UPLOAD_FOLDER):
    os.makedirs(UPLOAD_FOLDER)

# Mock S3 Client
s3_client = boto3.client('s3') if os.environ.get('AWS_ACCESS_KEY_ID') else None

def upload_to_s3(file_path, s3_key):
    """
    Helper to upload the raw image and processed heatmap to an S3 bucket.
    """
    if not s3_client:
        print(f"[Mock S3] Uploading {file_path} to s3://{S3_BUCKET}/{s3_key}")
        return f"https://mock-s3-url.com/{S3_BUCKET}/{s3_key}"
        
    try:
        s3_client.upload_file(file_path, S3_BUCKET, s3_key)
        return f"https://{S3_BUCKET}.s3.amazonaws.com/{s3_key}"
    except NoCredentialsError:
        print("Credentials not available for S3 upload.")
        return None

def process_ndvi_heatmap(image_path, output_path):
    """
    Processes a drone image to calculate a mock Normalized Difference Vegetation Index (NDVI).
    NDVI highlights live green vegetation. Healthy crops yield high NDVI values.
    """
    # Read the image using OpenCV
    image = cv2.imread(image_path)
    if image is None:
        raise ValueError("Could not read image file.")

    # Split into Blue, Green, Red channels (OpenCV uses BGR by default)
    # In a real multispectral drone image, we would have a Near-Infrared (NIR) channel.
    # For this mock implementation using standard RGB, we simulate NDVI using (G - R)/(G + R).
    b, g, r = cv2.split(image.astype(float))
    
    # Calculate pseudo-NDVI
    bottom = (g + r)
    bottom[bottom == 0] = 0.0001 # Prevent divide by zero
    ndvi = (g - r) / bottom

    # Normalize to 0-255 for visualization
    ndvi_normalized = cv2.normalize(ndvi, None, 0, 255, cv2.NORM_MINMAX, dtype=cv2.CV_8U)
    
    # Apply a colormap (e.g., COLORMAP_SUMMER where green is healthy, yellow is stressed)
    heatmap = cv2.applyColorMap(ndvi_normalized, cv2.COLORMAP_SUMMER)
    
    # Save the processed heatmap
    cv2.imwrite(output_path, heatmap)
    
    # Calculate health score (0-100) based on average "greenness"
    health_score = np.mean(ndvi) * 100
    
    alerts = []
    if health_score < 10:
        alerts.append("Critical nutrient deficiency detected.")
    elif health_score < 30:
        alerts.append("Moderate stress detected. Check irrigation/fertilizer levels.")

    return {
        "health_score": round(max(0, min(100, health_score)), 2),
        "alerts": alerts
    }

@drone_pipeline.route('/upload-imagery', methods=['POST'])
def upload_imagery():
    """
    Endpoint for the Farmer UI to upload drone imagery.
    Expects form-data with a 'file' and 'farmerId'.
    """
    if 'file' not in request.files:
        return jsonify({"error": "No file part in the request"}), 400
        
    file = request.files['file']
    farmer_id = request.form.get('farmerId', 'unknown_farmer')

    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if file:
        filename = secure_filename(file.filename)
        timestamp = str(int(os.path.getmtime(__file__) * 1000)) # Simple timestamp
        unique_filename = f"{farmer_id}_{timestamp}_{filename}"
        
        raw_filepath = os.path.join(UPLOAD_FOLDER, unique_filename)
        heatmap_filename = f"heatmap_{unique_filename}"
        heatmap_filepath = os.path.join(UPLOAD_FOLDER, heatmap_filename)
        
        # Save raw file locally
        file.save(raw_filepath)
        
        try:
            # 1. Process the image through the OpenCV NDVI pipeline
            analysis_result = process_ndvi_heatmap(raw_filepath, heatmap_filepath)
            
            # 2. Upload both raw and heatmap images to S3
            raw_s3_url = upload_to_s3(raw_filepath, f"raw/{unique_filename}")
            heatmap_s3_url = upload_to_s3(heatmap_filepath, f"heatmaps/{heatmap_filename}")
            
            # 3. Clean up local temp files
            if os.path.exists(raw_filepath): os.remove(raw_filepath)
            if os.path.exists(heatmap_filepath): os.remove(heatmap_filepath)

            # 4. Return the data payload for the Farmer UI map overlay
            return jsonify({
                "status": "SUCCESS",
                "farmerId": farmer_id,
                "imageryData": {
                    "rawImageUrl": raw_s3_url,
                    "heatmapUrl": heatmap_s3_url,
                    "healthScore": analysis_result["health_score"],
                    "localizedAlerts": analysis_result["alerts"]
                },
                "message": "Imagery processed successfully."
            }), 200

        except Exception as e:
            return jsonify({"error": str(e)}), 500
