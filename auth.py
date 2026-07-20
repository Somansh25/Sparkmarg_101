import os
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional, Any
from functools import wraps
from dotenv import load_dotenv
from jose import jwt, JWTError, ExpiredSignatureError
from werkzeug.security import generate_password_hash, check_password_hash
from flask import Blueprint, request, jsonify
from bson.objectid import ObjectId
from bson.errors import InvalidId  # CHANGED: Imported InvalidId to handle malformed ObjectId claims safely
from pydantic import ValidationError
from db import get_db, UserCreate

# Load environment variables and initialize the security audit logger.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))
logger = logging.getLogger("SparkMargAuth")

auth_bp = Blueprint('auth', __name__)
auth_bp.strict_slashes = False

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))

if not SECRET_KEY:
    logger.critical("SECRET_KEY is missing! Authentication system cannot start.")
    raise ValueError("SECRET_KEY must be set in the environment.")

def hash_password(password: str) -> str:
    return generate_password_hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return check_password_hash(hashed_password, plain_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def token_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        auth_header = request.headers.get('Authorization')
        if not auth_header or not auth_header.startswith('Bearer '):
            return jsonify({"error": "Authorization token required"}), 401
        try:
            token = auth_header.split(" ")[1]
            payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
            current_user_id = str(payload.get("sub"))
            
            # CHANGED: Validate ObjectId format to catch malformed claims before querying MongoDB
            user_obj_id = ObjectId(current_user_id)
            db = get_db()
            user = db["users"].find_one({"_id": user_obj_id})
            if not user or not user.get("is_active", True):
                return jsonify({"error": "User account is disabled or does not exist"}), 401
                
        except InvalidId:  # CHANGED: Explicitly catch invalid BSON ObjectId string formats in JWT sub
            logger.warning(f"Auth intercept: Malformed ObjectId claim '{current_user_id}'")
            return jsonify({"error": "Invalid token subject claim"}), 401
        except (ExpiredSignatureError, jwt.ExpiredSignatureError):
            return jsonify({"error": "Session expired. Please log in again."}), 401
        except (JWTError, ValueError, IndexError) as err:
            logger.warning(f"Auth intercept error: {err}")
            return jsonify({"error": "Invalid credentials"}), 401
        return f(current_user_id, *args, **kwargs)
    return decorated

@auth_bp.route('/register', methods=['POST'])
def register():
    data = request.get_json(force=True, silent=True) or {}
    try:
        user_data = UserCreate(**data)
        
        db = get_db()
        if db["users"].find_one({"email": user_data.email}):
            return jsonify({"error": "Email address already registered"}), 400

        user_doc = {
            "email": user_data.email,
            "password_hash": hash_password(user_data.password),
            "full_name": user_data.full_name,
            "created_at": datetime.now(timezone.utc),
            "is_active": True
        }
        db["users"].insert_one(user_doc)
        return jsonify({"message": "Registration successful"}), 201
    except ValidationError as ve:
        return jsonify({"error": ve.errors()}), 400
    except Exception as e:
        logger.error(f"Registration failure: {e}")
        return jsonify({"error": "Internal server error"}), 500

@auth_bp.route('/login', methods=['POST'])
def login():
    data = request.get_json(force=True, silent=True) or {}
    email, password = data.get('email'), data.get('password')
    if not email or not password:
        return jsonify({"error": "Email and password are required"}), 400
    db = get_db()
    user = db["users"].find_one({"email": email})
    if not user or not verify_password(password, user["password_hash"]):
        return jsonify({"error": "Authentication failed"}), 401
    token = create_access_token(data={"sub": str(user["_id"])})
    return jsonify({
        "access_token": token, 
        "token_type": "bearer",
        "user": {"id": str(user["_id"]), "full_name": user.get("full_name"), "email": user.get("email")}
    }), 200

@auth_bp.route('/me', methods=['GET'])
@token_required
def get_current_user(current_user_id):
    db = get_db()
    try:
        # CHANGED: Safely handle ObjectId conversion inside /me endpoint
        user = db["users"].find_one({"_id": ObjectId(current_user_id)})
    except InvalidId:  # CHANGED: Catch invalid user ID format and return HTTP 400
        return jsonify({"error": "Invalid user ID format"}), 400

    if not user:
        return jsonify({"error": "User account no longer exists"}), 404

    return jsonify({
        "user": {"id": str(user["_id"]), "full_name": user.get("full_name"), "email": user.get("email")}
    })