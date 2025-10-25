import jwt
from functools import wraps
from flask import request, jsonify
from datetime import datetime, timedelta
import os

# Configuration
JWT_SECRET = os.environ.get('JWT_SECRET', 'your-secret-key')  # In production, use environment variable
JWT_EXPIRATION = timedelta(hours=8)

# Mock user database (replace with real database in production)
users = {
    'admin@example.com': {
        'password': 'admin123',
        'role': 'faculty',
        'name': 'Admin User'
    },
    'faculty@example.com': {
        'password': 'faculty123',
        'role': 'faculty',
        'name': 'Faculty User'
    }
}

# Mock student database (replace with real database in production)
students = {}

def generate_token(email):
    """Generate a JWT token for the user"""
    payload = {
        'email': email,
        'role': users[email]['role'],
        'exp': datetime.utcnow() + JWT_EXPIRATION
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def validate_token(token):
    """Validate a JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

def auth_required(f):
    """Decorator to require authentication for routes"""
    @wraps(f)
    def decorated(*args, **kwargs):
        if request.method == 'OPTIONS':
            # Allow preflight requests
            return f(*args, **kwargs)
            
        auth_header = request.headers.get('Authorization')
        
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({
                'status': 'error',
                'message': 'Missing or invalid authorization header'
            }), 401
        
        token = auth_header.split(' ')[1]
        payload = validate_token(token)
        
        if not payload:
            return jsonify({
                'status': 'error',
                'message': 'Invalid or expired token'
            }), 401
        
        # Add user info to request
        request.user = payload
        return f(*args, **kwargs)
    
    return decorated

def faculty_required(f):
    """Decorator to require faculty role"""
    @wraps(f)
    def decorated(*args, **kwargs):
        if not hasattr(request, 'user') or request.user.get('role') != 'faculty':
            return jsonify({
                'status': 'error',
                'message': 'Faculty access required'
            }), 403
        return f(*args, **kwargs)
    
    return decorated