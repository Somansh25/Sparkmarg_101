import os
import threading
from typing import List, Dict, Optional, Any 
from datetime import datetime, timezone
from dotenv import load_dotenv
from pymongo import MongoClient 
from pydantic import BaseModel, EmailStr, Field

# Bind the application root directory to ensure environment and data files are found correctly.
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Load configuration from the .env file located at the project root.
load_dotenv(os.path.join(BASE_DIR, ".env"))

# Global client singleton to manage connection pooling efficiently
_mongo_client = None
_client_lock = threading.Lock()


def get_db():
    """Provides a thread-safe database handle using the environment configuration."""
    global _mongo_client
    if _mongo_client is None:
        with _client_lock:
            if _mongo_client is None:
                mongodb_url = os.getenv("MONGODB_URL")
                if not mongodb_url:
                    raise EnvironmentError("MONGODB_URL not found in environment variables.")
                try:
                    _mongo_client = MongoClient(mongodb_url)
                    _mongo_client.admin.command('ping') 
                except Exception as e:
                    _mongo_client = None
                    raise ConnectionError(f"Database connection failed: {str(e)}")
    
    database_name = os.getenv("DATABASE_NAME", "sparkmarg_db")
    
    return _mongo_client[database_name]

# --- USER SCHEMAS ---

# Define structural validation for incoming user registration data using Pydantic.
class UserCreate(BaseModel):
    email: EmailStr
    # Enforce a minimum length on passwords during the registration phase.
    password: str = Field(..., min_length=6, description="Minimum 6 characters")
    full_name: str = Field(..., min_length=2, description="Full name of the user")

# Validation model for login credentials
class UserLogin(BaseModel):
    email: EmailStr
    password: str

# Format user profile data for safe transmission, omitting sensitive credentials.
class UserResponse(BaseModel):
    id: str
    email: EmailStr
    full_name: str
    is_active: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# --- SIMULATION SCHEMAS ---

# Define the four core competency metrics tracked across all career simulations.
class ImpactScores(BaseModel):
    leadership: int = 0
    technical: int = 0
    problem_solving: int = 0
    communication: int = 0

# Represent a single decision choice within a simulation node, including its results.
class SimulationOption(BaseModel):
    option_id: str
    text: str
    feedback: str
    impact: ImpactScores = Field(default_factory=ImpactScores)
    next_step_id: Optional[str] = None 

# Define a scenario scene containing the context and possible user choices.
class SimulationStep(BaseModel):
    step_id: str
    title: str
    scenario: str
    options: List[SimulationOption]

# Provide a complete structural definition for a narrative career simulation track.
class SimulationSchema(BaseModel):
    id: str
    title: str
    domain: str 
    description: str
    difficulty: str 
    estimated_minutes: int
    steps: List[SimulationStep]

# Supply abbreviated metadata for simulation cards used in the catalog grid.
class SimulationSummary(BaseModel):
    id: str
    title: str
    domain: str
    description: str
    difficulty: str
    estimated_minutes: int

# Validation payload for user decision submissions
class DecisionSubmit(BaseModel):
    simulation_id: str
    step_id: str
    option_id: str

# Encapsulate the result of a user choice, including scores and narrative progress.
class DecisionResult(BaseModel):
    simulation_id: str
    step_id: str
    selected_option_id: str
    feedback: str
    impact: ImpactScores
    is_completed: bool = False
    next_step_id: Optional[str] = None

# Track the current state, score, and interaction history for a user's simulation session.
class SimulationProgress(BaseModel):
    id: Optional[str] = None
    user_id: str
    simulation_id: str
    current_step_id: str
    status: str = "IN_PROGRESS"
    total_scores: ImpactScores = Field(default_factory=ImpactScores)
    history: List[Dict[str, Any]] = Field(default_factory=list)
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

# Aggregate global performance metrics for the user's dashboard view.
class DashboardSummary(BaseModel):
    total_simulations_completed: int
    total_simulations_in_progress: int
    overall_scores: ImpactScores
    recent_activity: List[Dict[str, Any]]
