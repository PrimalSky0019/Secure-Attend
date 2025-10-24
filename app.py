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
from datetime import datetime

app = Flask(__name__)
CORS(app)  # Allow all origins for a hackathon

# --- Database Files ---
DB_FILE = 'database.json'
ATTENDANCE_FILE = 'attendance.json'

# --- MODEL CONFIGURATION ---
RECOGNITION_MODEL = "VGG-Face"
DETECTOR_BACKEND = "opencv"     # Using OpenCV for detection
SIMILARITY_THRESHOLD = 0.6      # Threshold for face recognition

print(f"--- Using Model: {RECOGNITION_MODEL} ---")
print(f"--- Using Detector: {DETECTOR_BACKEND} ---")

# --- Helper Functions ---

def load_database():
    """Loads the embeddings database from the JSON file."""
    if not os.path.exists(DB_FILE):
        return {}
    try:
        with open(DB_FILE, 'r') as f:
            content = f.read()
            if not content:
                return {}
            return json.loads(content)
    except json.JSONDecodeError:
        return {}

def load_attendance():
    """Loads the attendance records."""
    if not os.path.exists(ATTENDANCE_FILE):
        return {}
    try:
        with open(ATTENDANCE_FILE, 'r') as f:
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

def save_attendance(attendance):
    """Saves the attendance records."""
    with open(ATTENDANCE_FILE, 'w') as f:
        json.dump(attendance, f, indent=2)

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
    """Registers a new user."""
    data = request.json
    name = data.get('name')
    image_b64 = data.get('image')

    if not name or not image_b64:
        return jsonify({"status": "error", "message": "Name and image are required."}), 400

    try:
        img = base64_to_cv_image(image_b64)
        faces = find_faces(img)
        
        if not faces:
            return jsonify({"status": "error", "message": "No face detected. Please try again."}), 400
            
        if len(faces) > 1:
            return jsonify({"status": "error", "message": "Multiple faces detected. Please ensure only one person is in frame."}), 400

        embeddings = get_face_embeddings(img, faces)
        if not embeddings:
            return jsonify({"status": "error", "message": "Could not process the face. Please try again."}), 400

        # Load DB, add new user, save DB
        db = load_database()
        if name in db:
            return jsonify({"status": "error", "message": "User already registered."}), 400
        
        db[name] = embeddings[0]  # Store the first (and only) embedding
        save_database(db)
        
        print(f"Registered new user: {name} using {RECOGNITION_MODEL}")
        return jsonify({"status": "success", "message": f"User {name} registered successfully."})

    except Exception as e:
        print(f"Registration error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/check-in', methods=['POST'])
def check_in():
    """Checks in multiple users simultaneously."""
    image_b64 = request.json.get('image')
    if not image_b64:
        return jsonify({"status": "error", "message": "Image is required."}), 400

    try:
        img = base64_to_cv_image(image_b64)
        faces = find_faces(img)
        
        if not faces:
            return jsonify({"status": "error", "message": "No faces detected. Please try again."}), 400

        # Get embeddings for all detected faces
        embeddings = get_face_embeddings(img, faces)
        if not embeddings:
            return jsonify({"status": "error", "message": "Could not process faces. Please try again."}), 400

        # Load database
        db = load_database()
        if not db:
            return jsonify({"status": "error", "message": "No users registered yet."}), 400

        # Match each face
        recognized_users = []
        attendance = load_attendance()
        current_date = datetime.now().strftime("%Y-%m-%d")
        current_time = datetime.now().strftime("%H:%M:%S")

        for embedding in embeddings:
            name, confidence = match_face(embedding, db)
            if name:
                recognized_users.append({"name": name, "confidence": float(confidence)})
                
                # Record attendance
                if current_date not in attendance:
                    attendance[current_date] = {}
                if name not in attendance[current_date]:
                    attendance[current_date][name] = []
                attendance[current_date][name].append(current_time)

        save_attendance(attendance)

        if recognized_users:
            return jsonify({
                "status": "success",
                "recognized_users": recognized_users,
                "total_faces": len(faces)
            })
        else:
            return jsonify({
                "status": "error",
                "message": "No registered users recognized.",
                "total_faces": len(faces)
            })

    except Exception as e:
        print(f"Check-in error: {e}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/attendance', methods=['GET'])
def get_attendance():
    """Gets attendance records."""
    date = request.args.get('date', datetime.now().strftime("%Y-%m-%d"))
    attendance = load_attendance()
    return jsonify(attendance.get(date, {}))

if __name__ == '__main__':
    # Create necessary files
    if not os.path.exists(DB_FILE):
        save_database({})
    if not os.path.exists(ATTENDANCE_FILE):
        save_attendance({})
    
    print("Starting server...")
    app.run(host='0.0.0.0', port=5000, debug=True)

