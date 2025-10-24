// Configuration
const BACKEND_URL = 'http://127.0.0.1:5000';
const FACE_DETECTION_INTERVAL = 1000; // 1 second

// DOM Elements
const video = document.getElementById('video');
const faceOverlay = document.getElementById('face-overlay');
const recognitionStatus = document.getElementById('recognition-status');
const attendanceList = document.getElementById('attendanceList');
const courseInfo = document.getElementById('courseInfo');
const currentTime = document.getElementById('currentTime');
const addStudentModal = document.getElementById('addStudentModal');
const notification = document.getElementById('notification');

// State
let stream = null;
let detectionInterval = null;
let currentCourse = null;
let recognizedFaces = new Set();

// Initialize
async function init() {
    await setupWebcam();
    updateTime();
    loadCourseData();
    setupEventListeners();
    startFaceDetection();
    
    // Check authentication
    if (!localStorage.getItem('auth_token')) {
        window.location.href = '/login';
        return;
    }
}

// Webcam Setup
async function setupWebcam() {
    try {
        if (stream) {
            stream.getTracks().forEach(track => track.stop());
        }
        
        stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: "user"
            }
        });
        
        video.srcObject = stream;
        await video.play();
    } catch (err) {
        showNotification('Could not access webcam', 'error');
        console.error(err);
    }
}

// Face Detection
function startFaceDetection() {
    detectionInterval = setInterval(async () => {
        const frame = captureVideoFrame();
        if (!frame) return;

        try {
            const response = await fetch(`${BACKEND_URL}/check-in`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
                },
                body: JSON.stringify({ 
                    image: frame,
                    course_code: currentCourse?.code
                })
            });

            const result = await response.json();
            updateFaceOverlay(result);
            updateAttendanceList(result);

        } catch (err) {
            console.error('Face detection error:', err);
        }
    }, FACE_DETECTION_INTERVAL);
}

function updateFaceOverlay(result) {
    faceOverlay.innerHTML = '';

    if (result.faces) {
        result.faces.forEach(face => {
            const box = document.createElement('div');
            box.className = `face-box ${getFaceBoxClass(face)}`;
            box.style.left = `${face.box.left}px`;
            box.style.top = `${face.box.top}px`;
            box.style.width = `${face.box.width}px`;
            box.style.height = `${face.box.height}px`;

            // Add name label if recognized
            if (face.name) {
                const label = document.createElement('div');
                label.className = 'absolute -top-6 left-0 bg-black/75 px-2 py-1 text-sm rounded';
                label.textContent = face.name;
                box.appendChild(label);
            }

            faceOverlay.appendChild(box);
        });
    }
}

function getFaceBoxClass(face) {
    if (face.isRecognized) return 'recognized';
    if (face.isNew) return 'new';
    return 'unrecognized';
}

function updateAttendanceList(result) {
    if (!result.recognized_users) return;

    result.recognized_users.forEach(user => {
        if (!recognizedFaces.has(user.reg_no)) {
            recognizedFaces.add(user.reg_no);
            
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${user.reg_no}</td>
                <td>${user.name}</td>
                <td>${new Date().toLocaleTimeString()}</td>
                <td>
                    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Present
                    </span>
                </td>
            `;
            attendanceList.appendChild(row);
        }
    });
}

// Course Management
async function loadCourseData() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/courses`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            }
        });
        const courses = await response.json();
        
        const courseSelect = document.getElementById('courseCode');
        const venueSelect = document.getElementById('venue');
        
        courses.forEach(course => {
            const option = document.createElement('option');
            option.value = course.code;
            option.textContent = `${course.code} - ${course.name}`;
            courseSelect.appendChild(option);
        });

        // Load venues
        const venues = [...new Set(courses.map(c => c.venue))];
        venues.forEach(venue => {
            const option = document.createElement('option');
            option.value = venue;
            option.textContent = venue;
            venueSelect.appendChild(option);
        });
    } catch (err) {
        showNotification('Could not load course data', 'error');
        console.error(err);
    }
}

// Export Functionality
document.getElementById('exportBtn').addEventListener('click', async () => {
    if (!currentCourse) {
        showNotification('Please select a course first', 'warning');
        return;
    }

    try {
        const response = await fetch(`${BACKEND_URL}/api/export-attendance`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify({
                course_code: currentCourse.code,
                date: new Date().toISOString().split('T')[0]
            })
        });

        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `attendance_${currentCourse.code}_${new Date().toISOString().split('T')[0]}.xlsx`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);

        showNotification('Attendance exported successfully', 'success');
    } catch (err) {
        showNotification('Could not export attendance', 'error');
        console.error(err);
    }
});

// Add New Student
document.getElementById('addStudentForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = {
        reg_no: document.getElementById('regNo').value,
        name: document.getElementById('studentName').value,
        course: document.getElementById('studentCourse').value,
        image: await captureVideoFrame()
    };

    try {
        const response = await fetch(`${BACKEND_URL}/api/add-student`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
            },
            body: JSON.stringify(formData)
        });

        const result = await response.json();
        
        if (response.ok) {
            showNotification('Student added successfully', 'success');
            addStudentModal.classList.add('hidden');
            document.getElementById('addStudentForm').reset();
        } else {
            showNotification(result.message, 'error');
        }
    } catch (err) {
        showNotification('Could not add student', 'error');
        console.error(err);
    }
});

// Utility Functions
function captureVideoFrame() {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0);
    return canvas.toDataURL('image/jpeg', 0.9);
}

function updateTime() {
    currentTime.textContent = new Date().toLocaleTimeString();
    setTimeout(updateTime, 1000);
}

function showNotification(message, type) {
    notification.textContent = message;
    notification.className = `notification ${type}`;
    notification.classList.remove('hidden');

    setTimeout(() => {
        notification.classList.add('hidden');
    }, 3000);
}

// Event Listeners
function setupEventListeners() {
    // Course Selection
    document.getElementById('courseCode').addEventListener('change', (e) => {
        const code = e.target.value;
        currentCourse = { code };
        courseInfo.textContent = `Current Course: ${code}`;
        recognizedFaces.clear();
        attendanceList.innerHTML = '';
    });

    // Camera Controls
    document.getElementById('toggleCamera').addEventListener('click', () => {
        if (stream && stream.active) {
            stream.getTracks().forEach(track => track.stop());
            video.srcObject = null;
        } else {
            setupWebcam();
        }
    });

    // Logout
    document.getElementById('logout').addEventListener('click', () => {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
    });

    // Modal Controls
    document.getElementById('cancelAdd').addEventListener('click', () => {
        addStudentModal.classList.add('hidden');
        document.getElementById('addStudentForm').reset();
    });
}

// Start the application
init();