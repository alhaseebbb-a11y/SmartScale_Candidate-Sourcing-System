#!/usr/bin/env bash
set -e

echo "Running database migrations..."
alembic upgrade head

echo "Seeding initial admin user..."
python -m app.db.seed

echo "Starting Uvicorn web server on port ${PORT:-8000}..."
exec uvicorn app.main:create_app --factory --host 0.0.0.0 --port ${PORT:-8000}
