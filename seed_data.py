# seed_data.py
import os
import json
import logging
from time import time
from datetime import datetime, timezone
from pymongo.errors import PyMongoError, ConnectionFailure
from db import get_db

# 1. Setup Enterprise-Grade Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("database_migrations.log", encoding="utf-8")
    ]
)
logger = logging.getLogger("SparkMargSeeder")

# 2. Strict Schema Rule Definitions
REQUIRED_ROOT_KEYS = {"id", "title", "domain", "difficulty", "description", "steps", "tech_stack", "estimated_minutes"}
REQUIRED_STEP_KEYS = {"step_id", "title", "scenario", "options"}
REQUIRED_OPTION_KEYS = {"option_id", "text", "feedback", "next_step_id", "impact"}
REQUIRED_IMPACT_KEYS = {"leadership", "technical", "problem_solving", "communication"}

def validate_simulation_schema(track: dict) -> bool:
    """Performs deep structural validation on simulation trees before database insertion."""
    missing_root = REQUIRED_ROOT_KEYS - track.keys()
    if missing_root:
        logger.error(f"Schema Violation: Track '{track.get('title', 'Untitled')}' is missing root keys: {missing_root}")
        return False

    for dynamic_idx, step in enumerate(track.get("steps", [])):
        missing_step = REQUIRED_STEP_KEYS - step.keys()
        if missing_step:
            logger.error(f"Schema Violation: Step index {dynamic_idx} in '{track['title']}' missing keys: {missing_step}")
            return False
        
        for opt_idx, option in enumerate(step.get("options", [])):
            missing_opt = REQUIRED_OPTION_KEYS - option.keys()
            if missing_opt:
                logger.error(f"Schema Violation: Option index {opt_idx} in step '{step['step_id']}' missing keys: {missing_opt}")
                return False
            
            missing_impact = REQUIRED_IMPACT_KEYS - option.get("impact", {}).keys()
            if missing_impact:
                logger.error(f"Schema Violation: Impact vector in option '{option['option_id']}' missing vectors: {missing_impact}")
                return False
                
    return True

def ensure_local_assets_exist(file_path: str):
    """Guarantees directory trees and baseline templates exist before loading operations."""
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    if not os.path.exists(file_path):
        logger.info(f"Asset file absent. Generating production catalog blueprint template at {file_path}")
        default_template = [
            {
                "id": "sim_ai_02",
                "title": "LLM Quantization Strategy",
                "domain": "Artificial Intelligence",
                "tech_stack": "PyTorch, HuggingFace, CUDA",
                "difficulty": "Expert",
                "description": "Optimize a heavy 70B parameter open-source foundation model for real-time mobile low-latency runtimes.",
                "estimated_minutes": 25,
                "steps": [
                    {
                        "step_id": "Node_Quant_01",
                        "title": "Initial Model Compression Assessment",
                        "scenario": "The uncompressed foundation model consumes over 140GB of VRAM, exceeding local edge hardware profiles. Which compression strategy do you execute?",
                        "options": [
                            {
                                "option_id": "opt_01_01",
                                "text": "Implement 4-bit AWQ (Activation-aware Weight Quantization) to shield high-salience activation channels.",
                                "feedback": "Excellent choice. AWQ preserves performance across critical attention steps while cutting memory overhead.",
                                "next_step_id": "Node_Quant_02",
                                "impact": {"leadership": 10, "technical": 25, "problem_solving": 20, "communication": 15}
                            },
                            {
                                "option_id": "opt_01_02",
                                "text": "Deploy uniform scalar INT8 quantization across all layers.",
                                "feedback": "Perplexity spikes dramatically. Outlier features are dropped, causing severe model accuracy degradation.",
                                "next_step_id": "Node_Quant_02",
                                "impact": {"leadership": 5, "technical": 10, "problem_solving": 5, "communication": 10}
                            }
                        ]
                    },
                    {
                        "step_id": "Node_Quant_02",
                        "title": "Runtime Memory Bandwidth Triage",
                        "scenario": "The model sizes fit into local memory, but heavy serialization latency creates an execution bottleneck. How do you resolve this compile-time lag?",
                        "options": [
                            {
                                "option_id": "opt_02_01",
                                "text": "Write a custom fused CUDA kernel wrapper to merge flash-attention optimization steps.",
                                "feedback": "Outstanding engineering choice! Layer fusion reduces high-latency global memory fetches completely.",
                                "next_step_id": None,
                                "impact": {"leadership": 15, "technical": 30, "problem_solving": 25, "communication": 10}
                            },
                            {
                                "option_id": "opt_02_02",
                                "text": "Increase core thread distribution counts inside standard orchestration parameters.",
                                "feedback": "Modest speed gains achieved, but execution hits fundamental limitations without explicit hardware layer splits.",
                                "next_step_id": None,
                                "impact": {"leadership": 10, "technical": 15, "problem_solving": 15, "communication": 10}
                            }
                        ]
                    }
                ]
            }
        ]
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(default_template, f, indent=2, ensure_ascii=False)

def run_migration_sync():
    start_time = time()
    logger.info("Starting production database synchronization pipeline...")
    base_dir = os.path.dirname(os.path.abspath(__file__))
    json_data_file = os.path.join(base_dir, "data", "simulations.json")
    ensure_local_assets_exist(json_data_file)
    try:
        with open(json_data_file, "r", encoding="utf-8") as f:
            career_tracks = json.load(f)
    except (json.JSONDecodeError, IOError) as err:
        logger.critical(f"Migration Aborted: File compilation parsing failure: {err}")
        return

    try:
        db = get_db()
        db.client.admin.command('ping')
        
        # Enforce Production Database Index Patterns
        db["simulations"].create_index("id", unique=True)
        # CHANGED: Added index on simulations domain field to optimize catalog filter queries
        db["simulations"].create_index("domain")

        db["user_progress"].create_index([("user_id", 1), ("simulation_id", 1)])
        # CHANGED: Added compound index on user_id + status to accelerate active and historical progress lookups
        db["user_progress"].create_index([("user_id", 1), ("status", 1)])

        logger.info("MongoDB cluster indices successfully validated and verified.")
    except (ConnectionFailure, Exception) as conn_err:
        logger.critical(f"Migration Aborted: Remote cloud connection failure: {conn_err}")
        return

    successful_upserts = 0
    for track in career_tracks:
        if not validate_simulation_schema(track):
            logger.warning(f"Skipping registration for pathway ID: {track.get('id', 'Unknown')} due to validation faults.")
            continue
            
        try:
            result = db["simulations"].update_one(
                {"id": track["id"]},
                {"$set": track},
                upsert=True
            )
            if result.upserted_id:
                logger.info(f"Created new simulation blueprint: '{track['title']}' [{track['id']}]")
            else:
                logger.info(f"Refreshed existing simulation boundaries: '{track['title']}' [{track['id']}]")
            successful_upserts += 1
        except PyMongoError as db_write_err:
            logger.error(f"Write transactional failure for record node {track.get('id')}: {db_write_err}")

    duration = time() - start_time
    logger.info(f"Migration finalized in {duration:.2f}s. Synced {successful_upserts}/{len(career_tracks)} scenarios to production.")

if __name__ == "__main__":
    run_migration_sync()