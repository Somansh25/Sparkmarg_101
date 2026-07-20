# SparkMarg

SparkMarg is an interactive career simulation platform that allows students to explore career paths through active, scenario-based simulations. Built with FastAPI on the backend and modern vanilla HTML5, CSS3, and JavaScript on the frontend.

---

## 🏗️ Project Structure

```text
sparkmarg/
├── templates/                  # HTML Views
│   ├── index.html              # Landing Page
│   ├── catalog.html            # Simulation Catalog
│   ├── dashboard.html          # Student Dashboard & Progress
│   └── simulation.html         # Interactive Simulation Engine
├── static/                     # Frontend Assets
│   ├── css/
│   │   ├── style.css           # Core styling & design variables
│   │   └── animations.css      # Keyframe animations & transitions
│   └── js/
│       ├── api.js              # Centralized API HTTP client wrapper
│       ├── app.js              # Global helper utilities
│       ├── catalog.js          # Catalog filtering & card interactions
│       ├── dashboard.js        # Progress stats & chart rendering
│       └── simulation.js       # Active scenario state player
├── .env                        # Environment configuration
├── .gitignore                  # Git tracking exclusions
├── auth.py                     # JWT authentication & password hashing
├── db.py                       # MongoDB connection & Pydantic models
├── main.py                     # Entry point & FastAPI route handlers
├── seed_data.py                     # Database seeding script
├── README.md                   # Documentation
└── requirements.txt            # Python dependencies
```
⚡ Quick Start Guide
1. Set Up Virtual Environment
```bash
python3 -m venv .venv
source .venv/bin/activate
```
2. Install Dependencies
```bash
pip install -r requirements.txt
```
3. Configure Environment Variables
Create a .env file in the root directory (or use the provided defaults):
```
Code snippet
APP_NAME="SparkMarg"
ENVIRONMENT="development"
DEBUG=True
HOST="0.0.0.0"
PORT=8000

MONGODB_URL="mongodb+srv://<username>:<password>@cluster0.mongodb.net/sparkmarg_db?appName=Cluster0"
DATABASE_NAME="sparkmarg_db"

SECRET_KEY="dev_super_secret_key_change_in_production_32bytes_long"
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

ALLOWED_ORIGINS="http://localhost:8000,[http://127.0.0.1:8000](http://127.0.0.1:8000)"
```
4. Seed the Database
Populate MongoDB with default simulations and scenario nodes:

```bash
python3 seed_data.py
```
5. Start the Application
```bash
python3 main.py
```
The application will launch on http://0.0.0.0:8000 (or http://localhost:8000).

🌐 Route Reference
HTML Page Views
Home / Landing: / or /index.html

Catalog: /catalog or /catalog.html

Dashboard: /dashboard or /dashboard.html

Simulation Room: /simulation or /simulation.html

Interactive API Documentation
Swagger UI: http://localhost:8000/docs

ReDoc: http://localhost:8000/redoc


---