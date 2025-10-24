// Shared JS for faculty-facing index pages
const BACKEND_URL = 'http://127.0.0.1:5000';

const videoRegister = document.getElementById('video-register');
const videoCheckin = document.getElementById('video-checkin');
const canvas = document.getElementById('canvas');
const nameInput = document.getElementById('name');

const registerButton = document.getElementById('register-button');
const registerText = document.getElementById('register-text');
const registerSpinner = document.getElementById('register-spinner');
const registerStatus = document.getElementById('register-status');

const checkinButton = document.getElementById('checkin-button');
const checkinText = document.getElementById('checkin-text');
const checkinSpinner = document.getElementById('checkin-spinner');
const checkinStatus = document.getElementById('checkin-status');

const serverStatus = document.getElementById('server-status');
const currentTime = document.getElementById('current-time');

let localStream = null;

async function init() {
    // Ensure user is authenticated on client-side (token stored in localStorage)
    if (!localStorage.getItem('token')) {
        window.location.href = '/login';
        return;
    }
    await setupWebcam();
    checkServerConnection();
    updateTime();
    setInterval(updateTime, 1000);
}

async function checkServerConnection() {
    try {
        const response = await fetch(BACKEND_URL);
        if (response.ok) {
            if (serverStatus) {
                serverStatus.textContent = 'Server Connected';
                serverStatus.className = 'text-sm px-3 py-1 rounded-full bg-green-500/10 text-green-400 border border-green-500/20';
            }
        }
    } catch (err) {
        if (serverStatus) {
            serverStatus.textContent = 'Server Offline';
            serverStatus.className = 'text-sm px-3 py-1 rounded-full bg-red-500/10 text-red-400 border border-red-500/20';
        }
    }
}

function updateTime() {
    if (!currentTime) return;
    const now = new Date();
    currentTime.textContent = now.toLocaleTimeString();
}

async function setupWebcam() {
    try {
        if (localStream) {
            localStream.getTracks().forEach(track => track.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' }, audio: false });
        localStream = stream;
        if (videoRegister) videoRegister.srcObject = stream;
        if (videoCheckin) videoCheckin.srcObject = stream;
        if (videoRegister) videoRegister.play();
        if (videoCheckin) videoCheckin.play();
    } catch (err) {
        console.error('Error accessing webcam: ', err);
        if (registerStatus) showStatus(registerStatus, 'Error: Could not access webcam.', 'error');
        if (checkinStatus) showStatus(checkinStatus, 'Error: Could not access webcam.', 'error');
    }
}

function captureFrame(videoElement) {
    if (!videoElement) return null;
    if (videoElement.readyState < 3) return null;
    const context = canvas.getContext('2d');
    canvas.width = videoElement.videoWidth || 1280;
    canvas.height = videoElement.videoHeight || 720;
    context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL('image/jpeg', 0.9);
}

if (registerButton) {
    registerButton.addEventListener('click', async () => {
        const name = nameInput ? nameInput.value.trim() : '';
        if (!name) { showStatus(registerStatus, 'Please enter a name.', 'error'); return; }
        const imageB64 = captureFrame(videoRegister);
        if (!imageB64) { showStatus(registerStatus, 'Webcam not ready. Please wait.', 'error'); return; }
        setLoading(registerButton, registerText, registerSpinner, true);
        showStatus(registerStatus, 'Processing...', 'pending');
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${BACKEND_URL}/register`, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { 'Authorization': `Bearer ${token}` } : {}), body: JSON.stringify({ name: name, image: imageB64 }) });
            const result = await response.json();
            if (response.ok && result.status === 'success') { showStatus(registerStatus, result.message, 'success'); if (nameInput) nameInput.value = ''; }
            else { showStatus(registerStatus, result.message || 'Registration failed', 'error'); }
        } catch (err) {
            console.error('Registration failed:', err);
            showStatus(registerStatus, 'Could not connect to server.', 'error');
        } finally { setLoading(registerButton, registerText, registerSpinner, false); }
    });
}

if (checkinButton) {
    checkinButton.addEventListener('click', async () => {
        const livelinessPrompt = document.getElementById('liveliness-prompt');
        if (livelinessPrompt) livelinessPrompt.classList.remove('hidden');
        showStatus(checkinStatus, 'Waiting for blink...', 'pending');
        await new Promise(resolve => setTimeout(resolve, 1500));
        if (livelinessPrompt) livelinessPrompt.classList.add('hidden');
        setLoading(checkinButton, checkinText, checkinSpinner, true);
        showStatus(checkinStatus, 'Verifying...', 'pending');
        const imageB64 = captureFrame(videoCheckin);
        if (!imageB64) { showStatus(checkinStatus, 'Webcam not ready. Please wait.', 'error'); setLoading(checkinButton, checkinText, checkinSpinner, false); return; }
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${BACKEND_URL}/check-in`, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, token ? { 'Authorization': `Bearer ${token}` } : {}), body: JSON.stringify({ image: imageB64 }) });
            const result = await response.json();
            if (response.ok && result.status === 'success') { showSuccess(checkinStatus, result); }
            else { const message = result.total_faces > 0 ? `${result.total_faces} faces detected but none recognized.` : result.message; showStatus(checkinStatus, message, 'error'); }
        } catch (err) {
            console.error('Check-in failed:', err);
            showStatus(checkinStatus, 'Could not connect to server.', 'error');
        } finally { setLoading(checkinButton, checkinText, checkinSpinner, false); }
    });
}

function setLoading(button, text, spinner, isLoading) {
    if (!button) return;
    button.disabled = isLoading;
    if (text) text.classList.toggle('hidden', isLoading);
    if (spinner) spinner.classList.toggle('hidden', !isLoading);
}

function showStatus(element, message, type) {
    if (!element) return;
    const statusHTML = `\n        <div class="status-message rounded-lg p-3 text-sm flex items-center justify-center space-x-2 ${type === 'success' ? 'bg-green-500/10 text-green-400 border border-green-500/20' : type === 'error' ? 'bg-red-500/10 text-red-400 border border-red-500/20' : 'bg-gray-500/10 text-gray-400 border border-gray-500/20'}">\n            <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                ${type === 'success' ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>' : type === 'error' ? '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>' : '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"/>'}\n            </svg>\n            <span>${message}</span>\n        </div>\n    `;
    element.innerHTML = statusHTML;
    if (type === 'success') {
        setTimeout(() => { if (element.innerHTML === statusHTML) { const div = element.querySelector('.status-message'); if (div) { div.classList.add('hidden'); setTimeout(() => { if (element.innerHTML === statusHTML) element.innerHTML = ''; }, 300); } } }, 3000);
    }
}

function showSuccess(element, data) {
    if (!element) return;
    let content = '';
    if (Array.isArray(data.recognized_users)) {
        content = data.recognized_users.map(user => { const confidencePercent = Math.round(user.confidence * 100); return `\n                <div class="flex items-center justify-between border-b border-green-500/20 last:border-0 py-2">\n                    <div class="flex items-center space-x-3">\n                        <svg class="h-5 w-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>\n                        </svg>\n                        <span class="text-green-400">${user.name}</span>\n                    </div>\n                    <span class="text-sm text-green-400/75">${confidencePercent}% match</span>\n                </div>\n            `; }).join('');
        const totalFaces = data.total_faces; const recognizedCount = data.recognized_users.length; const summaryText = totalFaces === recognizedCount ? `All ${totalFaces} faces recognized` : `${recognizedCount} of ${totalFaces} faces recognized`;
        content = `\n            <div class="success-animation">\n                <div class="p-4 rounded-lg bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/20">\n                    <div class="text-sm text-green-400/75 mb-2">${summaryText}</div>\n                    ${content}\n                </div>\n            </div>\n        `;
    } else {
        const message = typeof data === 'string' ? data : `Welcome back, ${data.name}!`;
        content = `\n            <div class="success-animation">\n                <div class="p-4 rounded-lg bg-gradient-to-r from-green-500/20 to-emerald-500/20 border border-green-500/20">\n                    <div class="flex items-center justify-center space-x-3">\n                        <svg class="h-6 w-6 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">\n                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/>\n                        </svg>\n                        <span class="text-lg font-medium text-green-400">${message}</span>\n                    </div>\n                </div>\n            </div>\n        `;
    }
    element.innerHTML = content;
    setTimeout(() => { if (element.innerHTML === content) { const div = element.querySelector('.success-animation'); if (div) { div.style.opacity = '0'; div.style.transform = 'translateY(-10px)'; setTimeout(() => { if (element.innerHTML === content) element.innerHTML = ''; }, 300); } } }, 5000);
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => { init().catch(err => console.error(err)); });
