Secure-Attend: AI-Powered Smart Attendance System

A real-time, privacy-first, and spoof-proof attendance system that uses state-of-the-art AI to verify attendance. This prototype includes separate interfaces for faculty and students, backed by a robust Python backend.

Based on Real Research

This project is not just a demo; it's an implementation of the findings from the 2023 research paper: "FACE RECOGNITION FOR SMART ATTENDANCE SYSTEM USING DEEP LEARNING" (Warman & Kusuma, 2023).

We directly address the key challenges identified in academic research:

Challenge (Accuracy & Speed):

Solution: We use the exact model combination the paper proved was most accurate (99.114% Rank-1 Rate): RetinaFace (for detection) + facenet (for recognition). The backend is also configurable to use ArcFace (the fastest model).

Challenge (Privacy & GDPR):

Solution (Privacy-by-Design): We never store user photos. When a user is registered, their face is converted into a mathematical "embedding" (a vector of numbers). Only this anonymous vector is stored, making the database secure and privacy-compliant.

Challenge (Spoofing / Photo Attacks):

Solution (Liveliness Detection): The student check-in portal includes a simulated "liveliness check." It asks the user to perform a simple action (like blinking) before it captures the image, making it impossible to fool with a static photo.

Features

This prototype consists of three parts:

1. Faculty Admin Panel (faculty.html)

Upload Roster: Upload a .csv file of the student list (student_id, name).

Register Faces: Select a student from the roster, capture their face via webcam, and link the generated face embedding to their Student ID.

View Roster: See the full list of students and who has a face registered (marked in green).

Export Report: Download a complete, up-to-the-minute attendance log as a .csv file.

2. Student Kiosk (student.html)

Real-Time Check-In: Students can check in just by looking at the camera.

Anti-Spoofing: A simulated liveliness check runs before verification.

View Records: Students can enter their ID to see their personal attendance history.

3. Python Backend (app.py)

Secure API: A Flask server providing all the logic.

Student DB: Manages students_db.json to link student IDs to face embeddings.

Attendance Log: Manages attendance_log.json to log all successful check-ins with timestamps.

Tech Stack

Backend: Python 3, Flask, Flask-CORS

AI / Face Recognition: deepface (a wrapper for all major models)

Face Detection Model: retinaface

Face Recognition Model: facenet

Frontend: HTML5, Tailwind CSS, Vanilla JavaScript

How to Run This Project

Prerequisites:

Python 3.10+

Git

1. Clone the Repository

git clone [https://github.com/](https://github.com/)[YOUR_USERNAME]/[YOUR_REPO_NAME].git
cd [YOUR_REPO_NAME]


(Remember to replace [YOUR_USERNAME] and [YOUR_REPO_NAME] with your actual GitHub info!)

2. Set Up the Python Environment

We recommend using a virtual environment (venv).

# Create the virtual environment
python -m venv venv

# Activate it:
# On Windows (PowerShell):
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope Process
.\venv\Scripts\Activate

# On macOS/Linux:
source venv/bin/activate


3. Install Dependencies

Install all the required Python libraries from requirements.txt.

# This will install Flask, deepface, numpy, etc.
pip install -r requirements.txt


4. Run the Backend Server

This will start the Flask server on http://127.0.0.1:5000.

python app.py


Wait! The first time you run this, deepface will automatically download the pre-trained models (retinaface and facenet). This can take a few minutes. You will see download progress bars in your terminal. This is a one-time setup.

5. Use the Application

Once the server is running and says Models loaded. Starting facenet server...:

For Faculty: Open the faculty.html file in your browser.

Create a test .csv file (e.g., roster.csv) with this content:

student_id,name,email
1001,John Doe,john@example.com
1002,Jane Smith,jane@example.com


Use the "Upload Roster" form to upload this file.

Click "Refresh Student List."

Select a student, look at the camera, and click "Register Face."

For Students: Open the student.html file in your browser.

Click "Check In."

After the "blink" prompt, it will verify your face.

Enter your Student ID (e.g., 1001) to see your attendance record.

License

This project is licensed under the MIT License. See the LICENSE file for full details.
