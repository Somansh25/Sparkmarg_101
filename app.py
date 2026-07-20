import os
from datetime import datetime, timezone
from flask import Flask, render_template, request, jsonify, session
from werkzeug.security import generate_password_hash, check_password_hash
from bson.objectid import ObjectId
from dotenv import load_dotenv

from config import config_by_name
from db import get_db

load_dotenv(override=True)

app = Flask(__name__)

# Initialize Configuration
env = os.environ.get('FLASK_ENV', 'development')
app.config.from_object(config_by_name.get(env, config_by_name['default']))
app.secret_key = app.config.get('SECRET_KEY')

# ==============================================================================
# DATABASE CONNECTION & SEEDING SETUP
# ==============================================================================
try:
    db = get_db()
    print("Connected to MongoDB successfully.")
except Exception as e:
    print(f"MongoDB connection failed: {e}. Running with mock in-memory fallback.")
    db = None

# Fallback Mock Store for standalone execution without local Mongo instance
MOCK_USERS = {}
MOCK_HISTORIES = []

DEFAULT_SIMULATIONS = [
    {
        "id": "sim_aiml_01",
        "title": "LLM Latency & Memory Bottleneck Mitigation",
        "domain": "AIML",
        "difficulty": "Hard",
        "description": "Diagnose high time-to-first-token latency spikes in a high-throughput enterprise LLM inference pipeline.",
        "tags": ["PyTorch", "vLLM", "CUDA", "TensorRT"],
        "nodes": {
            "node_start": {
                "text": "Your production LLM cluster is experiencing p99 latency spikes of >4000ms under 500 RPM. Monitoring alerts show high GPU memory fragmentation and KV-cache evictions. How do you investigate?",
                "is_terminal": False,
                "choices": [
                    {
                        "id": "choice_1a",
                        "label": "Implement PagedAttention & Continuous Batching",
                        "description": "Refactor inference server to vLLM with PagedAttention to eliminate memory fragmentation.",
                        "next_node_id": "node_paged_att",
                        "feedback": "PagedAttention dynamically allocates KV cache pages, reducing memory waste by 90% and stabilizing p99 latency."
                    },
                    {
                        "id": "choice_1b",
                        "label": "Increase GPU Instance Count Uniformly",
                        "description": "Scale out the cluster size by 2x without software optimizations.",
                        "next_node_id": "node_horizontal_scale",
                        "feedback": "Scaling hardware masks memory fragmentation temporarily but doubles operational expenditure with diminishing throughput gains."
                    }
                ]
            },
            "node_paged_att": {
                "text": "PagedAttention reduced latency to 450ms. Next, users report slow decoding speeds for long context prompts (>16k tokens). What optimization do you deploy?",
                "is_terminal": False,
                "choices": [
                    {
                        "id": "choice_2a",
                        "label": "Apply FlashAttention-2 with FP8 Quantization",
                        "description": "Quantize weights and leverage optimized attention kernels for extended contexts.",
                        "next_node_id": "node_finish_success",
                        "feedback": "FlashAttention-2 accelerates decoding by 2.5x while FP8 maintains model evaluation accuracy within 0.2% variance."
                    },
                    {
                        "id": "choice_2b",
                        "label": "Truncate Context Windows to 4k Tokens",
                        "description": "Enforce strict token context limits on input queries.",
                        "next_node_id": "node_finish_degraded",
                        "feedback": "Truncating context resolves performance constraints but severely degrades user capabilities and domain utility."
                    }
                ]
            },
            "node_horizontal_scale": {
                "text": "Cloud budget alerts triggered due to unoptimized scaling. GPU memory fragmentation persists across nodes. What recovery strategy do you execute?",
                "is_terminal": False,
                "choices": [
                    {
                        "id": "choice_3a",
                        "label": "Rollback and Deploy TensorRT-LLM Optimizations",
                        "description": "Revert node scale and compile model weights via TensorRT-LLM.",
                        "next_node_id": "node_finish_success",
                        "feedback": "TensorRT-LLM achieves optimal GPU throughput with minimal memory footprint."
                    }
                ]
            },
            "node_finish_success": {
                "text": "System stabilized! You successfully optimized LLM inference latency by 85% while staying strictly within infrastructure budget allocations.",
                "is_terminal": True,
                "score": 98
            },
            "node_finish_degraded": {
                "text": "Simulation concluded. Latency stabilized, but product features were compromised due to aggressive truncation.",
                "is_terminal": True,
                "score": 68
            }
        }
    },
    {
        "id": "sim_sys_02",
        "title": "Distributed Cache Stampede Prevention",
        "domain": "SYSTEMS",
        "difficulty": "Medium",
        "description": "Architect a resilient caching pattern to survive Redis cluster node failovers during peak traffic spikes.",
        "tags": ["Redis", "Distributed Systems", "Go", "Architecture"],
        "nodes": {
            "node_start": {
                "text": "A primary Redis node crashes under heavy load, causing 100,000 concurrent requests to hit the underlying PostgreSQL database simultaneously (Cache Stampede). DB CPU reaches 100%. What is your immediate remediation?",
                "is_terminal": False,
                "choices": [
                    {
                        "id": "c_mutex",
                        "label": "Implement Distributed Locks (Redlock / Mutex)",
                        "description": "Allow only one process to recompute the cache key while others await updates.",
                        "next_node_id": "node_mutex_done",
                        "feedback": "Distributed Mutex locks immediately shelter the primary database from redundant query execution."
                    },
                    {
                        "id": "c_restart",
                        "label": "Hard Restart PostgreSQL Primary Node",
                        "description": "Reboot database instances to clear connection pools.",
                        "next_node_id": "node_db_crash",
                        "feedback": "Restarting the DB without cache protection results in an immediate re-lock stampede upon startup."
                    }
                ]
            },
            "node_mutex_done": {
                "text": "Database CPU stabilized at 25%. To prevent future cache key expiration thundering herds, which long-term architectural pattern do you establish?",
                "is_terminal": False,
                "choices": [
                    {
                        "id": "c_probabilistic",
                        "label": "XFetch / Probabilistic Early Expiration",
                        "description": "Recompute cache keys probabilistically before TTL expires.",
                        "next_node_id": "node_sys_success",
                        "feedback": "Probabilistic early expiration completely eliminates cache thundering herd spikes with zero lock contention overhead."
                    }
                ]
            },
            "node_db_crash": {
                "text": "Database fell into a reboot loop due to sustained request flooding.",
                "is_terminal": True,
                "score": 35
            },
            "node_sys_success": {
                "text": "Architecture elevated to 99.999% cache availability standard. Distributed stampede risks neutralized.",
                "is_terminal": True,
                "score": 95
            }
        }
    }
]

# Seed DB if empty
if db is not None:
    if db["simulations"].count_documents({}) == 0:
        db["simulations"].insert_many(DEFAULT_SIMULATIONS)

# ==============================================================================
# ROUTE HANDLERS & API ENDPOINTS
# ==============================================================================

@app.route('/')
def index():
    """Renders the Single Page Application base host."""
    return render_template('index.html')

# ------------------------------------------------------------------------------
# AUTHENTICATION API
# ------------------------------------------------------------------------------

@app.route('/api/auth/me', methods=['GET'])
def get_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"user": None}), 200

    if db is not None:
        user = db["users"].find_one({"_id": ObjectId(user_id)})
        if user:
            return jsonify({
                "user": {
                    "id": str(user["_id"]),
                    "name": user.get("name") or user.get("full_name"),
                    "email": user.get("email")
                }
            }), 200
    elif user_id in MOCK_USERS:
        u = MOCK_USERS[user_id]
        return jsonify({
            "user": {
                "id": u["id"],
                "name": u.get("name") or u.get("full_name"),
                "email": u["email"]
            }
        }), 200

    session.clear()
    return jsonify({"user": None}), 200

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json() or {}
    full_name = data.get('full_name', '').strip()
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not full_name or not email or not password:
        return jsonify({"message": "All fields are required."}), 400
    if len(password) < 6:
        return jsonify({"message": "Password must be at least 6 characters."}), 400

    hashed_pw = generate_password_hash(password)

    if db is not None:
        if db["users"].find_one({"email": email}):
            return jsonify({"message": "User with this email already exists."}), 400
        
        res = db["users"].insert_one({
            "full_name": full_name,
            "email": email,
            "password_hash": hashed_pw,
            "created_at": datetime.now(timezone.utc)
        })
        user_id = str(res.inserted_id)
    else:
        for u in MOCK_USERS.values():
            if u["email"] == email:
                return jsonify({"message": "User with this email already exists."}), 400
        user_id = f"mock_{len(MOCK_USERS)+1}"
        MOCK_USERS[user_id] = {
            "id": user_id,
            "full_name": full_name,
            "email": email,
            "password_hash": hashed_pw
        }

    session['user_id'] = user_id
    return jsonify({
        "message": "Account created successfully.",
        "user": {"id": user_id, "name": full_name, "email": email}
    }), 201

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    email = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({"message": "Email and password are required."}), 400

    user_data = None
    user_id = None

    if db is not None:
        user = db["users"].find_one({"email": email})
        if user and check_password_hash(user.get("password_hash") or user.get("password", ""), password):
            user_data = user
            user_id = str(user["_id"])
    else:
        for uid, u in MOCK_USERS.items():
            stored_pw = u.get("password_hash") or u.get("password", "")
            if u["email"] == email and check_password_hash(stored_pw, password):
                user_data = u
                user_id = uid
                break

    if not user_data:
        return jsonify({"message": "Invalid email or password credentials."}), 401

    session['user_id'] = user_id
    return jsonify({
        "message": "Login successful.",
        "user": {
            "id": user_id,
            "name": user_data.get("full_name") or user_data.get("name"),
            "email": user_data["email"]
        }
    }), 200

@app.route('/api/auth/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({"message": "Logged out successfully."}), 200

# ------------------------------------------------------------------------------
# SIMULATION CATALOG & ENGINE API
# ------------------------------------------------------------------------------

@app.route('/api/simulations', methods=['GET'])
def get_simulations():
    if db is not None:
        sims = list(db["simulations"].find({}, {"_id": 0}))
    else:
        sims = DEFAULT_SIMULATIONS

    return jsonify({"simulations": sims}), 200

@app.route('/api/simulations/start', methods=['POST'])
def start_simulation():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"message": "Unauthorized session."}), 401

    data = request.get_json() or {}
    sim_id = data.get('simulation_id')

    simulation = None
    if db is not None:
        simulation = db["simulations"].find_one({"id": sim_id}, {"_id": 0})
    else:
        simulation = next((s for s in DEFAULT_SIMULATIONS if s["id"] == sim_id), None)

    if not simulation:
        return jsonify({"message": "Simulation profile not found."}), 404

    history_id = f"hist_{int(datetime.now(timezone.utc).timestamp())}"
    
    new_history = {
        "history_id": history_id,
        "user_id": user_id,
        "simulation_id": sim_id,
        "simulation_title": simulation["title"],
        "status": "IN_PROGRESS",
        "current_node_id": "node_start",
        "score": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat()
    }

    if db is not None:
        db["histories"].insert_one(new_history)
    else:
        MOCK_HISTORIES.append(new_history)

    return jsonify({
        "simulation": simulation,
        "start_node_id": "node_start",
        "history_id": history_id
    }), 200

@app.route('/api/simulations/step', methods=['POST'])
def step_simulation():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"message": "Unauthorized session."}), 401

    data = request.get_json() or {}
    history_id = data.get('history_id')
    node_id = data.get('node_id')
    choice_id = data.get('choice_id')

    # Fetch history
    history = None
    if db is not None:
        history = db["histories"].find_one({"history_id": history_id, "user_id": user_id})
    else:
        history = next((h for h in MOCK_HISTORIES if h["history_id"] == history_id and h["user_id"] == user_id), None)

    if not history:
        return jsonify({"message": "Active simulation history state missing."}), 404

    # Fetch simulation node details
    sim_id = history["simulation_id"]
    simulation = None
    if db is not None:
        simulation = db["simulations"].find_one({"id": sim_id})
    else:
        simulation = next((s for s in DEFAULT_SIMULATIONS if s["id"] == sim_id), None)

    current_node = simulation["nodes"].get(node_id) if simulation else None
    if not current_node:
        return jsonify({"message": "Invalid simulation node execution boundary."}), 400

    choice = next((c for c in current_node.get("choices", []) if c["id"] == choice_id), None)
    if not choice:
        return jsonify({"message": "Invalid decision selection choice."}), 400

    next_node_id = choice["next_node_id"]
    next_node = simulation["nodes"].get(next_node_id)

    status = "COMPLETED" if next_node.get("is_terminal") else "IN_PROGRESS"
    final_score = next_node.get("score", 0) if next_node.get("is_terminal") else 0

    # Update history state
    if db is not None:
        db["histories"].update_one(
            {"history_id": history_id},
            {"$set": {
                "current_node_id": next_node_id,
                "status": status,
                "score": final_score,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }}
        )
    else:
        history["current_node_id"] = next_node_id
        history["status"] = status
        history["score"] = final_score
        history["updated_at"] = datetime.now(timezone.utc).isoformat()

    return jsonify({
        "feedback": choice.get("feedback", "Choice recorded."),
        "next_node_id": next_node_id,
        "is_terminal": next_node.get("is_terminal", False),
        "score": final_score
    }), 200

# ------------------------------------------------------------------------------
# USER COMMAND CENTER / DASHBOARD API
# ------------------------------------------------------------------------------

@app.route('/api/user/dashboard', methods=['GET'])
def user_dashboard():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({"message": "Unauthorized session."}), 401

    if db is not None:
        histories = list(db["histories"].find({"user_id": user_id}, {"_id": 0}))
    else:
        histories = [h for h in MOCK_HISTORIES if h["user_id"] == user_id]

    completed = [h for h in histories if h.get("status") == "COMPLETED"]
    completed_count = len(completed)
    avg_score = round(sum(h.get("score", 0) for h in completed) / completed_count) if completed_count > 0 else 0

    skills_matrix = {
        "System Design": 88 if completed_count > 0 else 0,
        "Latency Optimization": 92 if completed_count > 0 else 0,
        "Resource Management": 78 if completed_count > 0 else 0,
        "Incident Recovery": 85 if completed_count > 0 else 0
    }

    return jsonify({
        "completed_count": completed_count,
        "avg_score": avg_score,
        "skills": skills_matrix,
        "history": sorted(histories, key=lambda x: x.get("updated_at", ""), reverse=True)
    }), 200

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=True)