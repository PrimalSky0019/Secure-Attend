import base64
import io
import json
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from deepface import DeepFace
from PIL import Image
import numpy as np
import re

app = Flask(__name__)
CORS(app)  # Allow all origins for a hackathon

# --- Database File ---
DB_FILE = 'database.json'

# --- MODEL CONFIGURATION ---
# Using VGG-Face model as requested
# VGG-Face is a well-established model with:
# - Good accuracy
# - Stable performance
# - Broad compatibility
RECOGNITION_MODEL = "VGG-Face"
DETECTOR_BACKEND = "opencv"     # Using OpenCV for detection

print(f"--- Using Model: {RECOGNITION_MODEL} ---")
print(f"--- Using Detector: {DETECTOR_BACKEND} ---")

# --- Helper Functions ---

def load_database():
    """Loads the embeddings database from the JSON file."""
    if not os.path.exists(DB_FILE):
        return {}
    try:
        with open(DB_FILE, 'r') as f:
            # Handle empty file case
            content = f.read()
            if not content:
                return {}
            return json.loads(content)
    except json.JSONDecodeError:
        return {}

def save_database(db):
    """Saves the embeddings database to the JSON file."""
    with open(DB_FILE, 'w') as f:
        json.dump(db, f, indent=2)

def base64_to_cv_image(base64_string):
    """Converts a Base64 string to a NumPy array (OpenCV format)."""
    # Remove the "data:image/png;base64," or "data:image/jpeg;base64," header
    base64_data = re.sub('^data:image/.+;base64,', '', base64_string)
    
    # Decode the image
    img_data = base64.b64decode(base64_data)
    
    # Convert to PIL Image
    pil_image = Image.open(io.BytesIO(img_data))
    
    # Convert PIL Image to NumPy array
    # If image is RGBA, convert to RGB
    if pil_image.mode == 'RGBA':
        pil_image = pil_image.convert('RGB')
        
    cv_image = np.array(pil_image)
    
    # Convert RGB (PIL format) to BGR (OpenCV format)
    cv_image = cv_image[:, :, ::-1].copy() 
    return cv_image

@app.route('/')
def home():
    return f"Secure-Attend Backend is running with {RECOGNITION_MODEL}!"

@app.route('/register', methods=['POST'])
def register():
    """
    Registers a new user.
    Receives: { "name": "John Doe", "image": "data:image/png;base64,..." }
    """
    data = request.json
    name = data.get('name')
    image_b64 = data.get('image')

    if not name or not image_b64:
        return jsonify({"status": "error", "message": "Name and image are required."}), 400

    try:
        # Convert base64 to image first
        img = base64_to_cv_image(image_b64)
        
        # Generate the embedding using the models from your research
        embedding_obj = DeepFace.represent(
            img_path = img,
            model_name = RECOGNITION_MODEL,
            detector_backend = DETECTOR_BACKEND,
            enforce_detection = True,
            align = True
        )
        
        # The embedding is in the response
        embedding = embedding_obj[0]["embedding"]

        # Load DB, add new user, save DB
        db = load_database()
        if name in db:
            return jsonify({"status": "error", "message": "User already registered."}), 400
        
        db[name] = embedding
        save_database(db)
        
        print(f"Registered new user: {name} using {RECOGNITION_MODEL}")
        return jsonify({"status": "success", "message": f"User {name} registered successfully."})

    except ValueError as e:
        print(f"Registration error: {e}")
        # This error is often "Face could not be detected"
        return jsonify({"status": "error", "message": "Could not detect a face. Please try again."}), 400
    except Exception as e:
        print(f"Internal server error: {e}")
        return jsonify({"status": "error", "message": f"An internal error occurred: {e}"}), 500

@app.route('/check-in', methods=['POST'])
def check_in():
    """
    Checks in a user.
    Receives: { "image": "data:image/png;base64,..." }
    """
    image_b64 = request.json.get('image')
    if not image_b64:
        return jsonify({"status": "error", "message": "Image is required."}), 400

    try:
        # 1. Convert base64 to image first
        img = base64_to_cv_image(image_b64)
        
        # Generate embedding for the live image
        live_embedding_obj = DeepFace.represent(
            img_path = img,
            model_name = RECOGNITION_MODEL,
            detector_backend = DETECTOR_BACKEND,
            enforce_detection = True,
            align = True
        )
        live_embedding = live_embedding_obj[0]["embedding"]

        # 2. Load the database
        db = load_database()
        if not db:
            return jsonify({"status": "error", "message": "No users registered yet."}), 400

        # 3. Find the best match
        best_match_name = "Unknown"
        match_found = False

        # We must manually check each one.
        for name, saved_embedding in db.items():
            if not isinstance(saved_embedding, list):
                print(f"Skipping invalid embedding for user {name}")
                continue
                
            # Calculate cosine similarity between embeddings
            from scipy.spatial.distance import cosine
            similarity = 1 - cosine(live_embedding, saved_embedding)
            
            # If similarity is high enough (threshold can be adjusted)
            if similarity > 0.6:  # 0.6 is a good threshold for VGG-Face
                best_match_name = name
                match_found = True
                break # Found a match

        if match_found:
            print(f"Check-in successful: {best_match_name}")
            return jsonify({"status": "success", "name": best_match_name})
        else:
            print("Check-in failed: User not recognized.")
            return jsonify({"status": "error", "message": "User not recognized."})

    except ValueError as e:
        print(f"Check-in error: {e}")
        # This error is often "Face could not be detected"
        return jsonify({"status": "error", "message": "Could not detect a face for check-in."}), 400
    except Exception as e:
        print(f"Internal server error: {e}")
        return jsonify({"status": "error", "message": f"An internal error occurred: {e}"}), 500

if __name__ == '__main__':
    # Create the database file if it doesn't exist
    if not os.path.exists(DB_FILE):
        save_database({})
    
    print("Starting server...")
    
    app.run(host='0.0.0.0', port=5000, debug=True)

