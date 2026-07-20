import os
from datetime import timedelta
from dotenv import load_dotenv
load_dotenv(override=True)
class Config:
    """Base Configuration Parameters for SparkMarg Engine."""
    
    # Core Application Security
    SECRET_KEY = os.environ.get('SECRET_KEY', 'sparkmarg-glassmorphic-production-secret-key-2026')
    
    # Database Settings
    MONGO_URI = os.environ.get('MONGODB_URL') or os.environ.get('MONGO_URI')
    
    # Session Management
    PERMANENT_SESSION_LIFETIME = timedelta(days=7)
    SESSION_COOKIE_HTTPONLY = True
    SESSION_COOKIE_SAMESITE = 'Lax'
    SESSION_COOKIE_SECURE = os.environ.get('FLASK_ENV') == 'production'
    
    # Security Headers & ReDoS/Pydantic Safeguards
    MAX_CONTENT_LENGTH = 16 * 1024 * 1024  # 16 MB Max Upload Limit
    JSON_SORT_KEYS = False


class DevelopmentConfig(Config):
    """Development Environment Settings."""
    DEBUG = True
    TESTING = False


class ProductionConfig(Config):
    """Production Environment Settings."""
    DEBUG = False
    TESTING = False


class TestingConfig(Config):
    """Testing Environment Settings."""
    DEBUG = True
    TESTING = True
    MONGO_URI = 'mongodb://localhost:27017/sparkmarg_test_db'


config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}