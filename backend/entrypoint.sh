#!/bin/sh
set -e

echo "[ish] applying migrations..."
alembic upgrade head

if [ "$ISH_SEED_ON_START" = "true" ]; then
  echo "[ish] seeding demo data (idempotent)..."
  python -m app.seed
fi

echo "[ish] starting API on :8000"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
