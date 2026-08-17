#!/bin/sh
set -e

# Simple retry loop for applying migrations until DB is available
# (keeps startup robust when DB takes a moment to initialize)
MAX_RETRIES=10
COUNT=0
until python manage.py migrate --noinput; do
  COUNT=$((COUNT+1))
  if [ $COUNT -ge $MAX_RETRIES ]; then
    echo "Migrations failed after $COUNT attempts"
    exit 1
  fi
  echo "Migration attempt $COUNT failed — retrying in 3s..."
  sleep 3
done

python manage.py collectstatic --noinput || true

# Exec the container command (gunicorn by default)
exec "$@"
