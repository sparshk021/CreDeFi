# CreDeFi Backend

FastAPI backend with async PostgreSQL, JWT auth, and Alembic migrations.

## Quick Start

```bash
# 1. Create virtual environment
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # macOS / Linux

# 2. Install dependencies
pip install -r requirements.txt

# 3. Copy env and configure
cp .env.example .env

# 4. Create the database
# Ensure PostgreSQL is running, then:
createdb credefi

# 5. Run migrations
alembic upgrade head

# 6. Start dev server
uvicorn main:app --reload --port 8000
```

## Project Structure

```
backend/
├── alembic/              # Migration scripts
├── app/
│   ├── api/              # Route handlers
│   ├── core/             # Config, security, dependencies
│   ├── db/               # Engine & session factories
│   ├── models/           # SQLAlchemy ORM models
│   ├── schemas/          # Pydantic request/response models
│   ├── services/         # Business logic layer
│   └── utils/            # Shared helpers
├── main.py               # Application entrypoint
├── alembic.ini
├── requirements.txt
└── .env.example
```

## API Endpoints

| Method | Path                | Auth | Description          |
|--------|---------------------|------|----------------------|
| GET    | `/health`           | No   | Health check         |
| POST   | `/auth/register`    | No   | Create account       |
| POST   | `/auth/login`       | No   | Get JWT token        |
| POST   | `/auth/wallet-login`| No   | Login via wallet sig |

## Migrations

```bash
# Generate a new migration after model changes
alembic revision --autogenerate -m "describe change"

# Apply migrations
alembic upgrade head

# Rollback one step
alembic downgrade -1
```
