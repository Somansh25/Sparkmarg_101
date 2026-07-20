import logging
from seed_data import run_migration_sync

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("UnifiedDataIngest")

def sync_simulations():
    """
    Entry point for runtime data synchronization. 
    Delegates to the validated seed_data migration pipeline.
    """
    logger.info("Initializing runtime simulation sync...")
    run_migration_sync()

if __name__ == "__main__":
    sync_simulations()