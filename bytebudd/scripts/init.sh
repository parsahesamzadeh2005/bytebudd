#!/bin/bash
# ByteBudd initialization script
# Run once after `docker compose up -d` to set up the application

set -e

echo "======================================"
echo "  ByteBudd Initialization Script"
echo "======================================"
echo ""

# Wait for services to be ready
echo "[1/4] Waiting for services to start..."
sleep 5

# Run database migrations
echo "[2/4] Running database migrations..."
docker compose exec backend alembic upgrade head
echo "      ✓ Migrations complete"

# Create admin user
echo "[3/4] Creating admin user..."
docker compose exec backend python /app/../scripts/create_admin.py
echo "      ✓ Admin user ready"

# Pull Ollama model
echo "[4/4] Pulling AI model (this may take a while)..."
docker compose exec ollama ollama pull qwen2.5-coder:8b
echo "      ✓ Model downloaded"

echo ""
echo "======================================"
echo "  ByteBudd is ready!"
echo "======================================"
echo ""
echo "  → App:  http://localhost"
echo "  → API:  http://localhost/api/docs"
echo ""
echo "  Default credentials:"
echo "    Email:    admin@bytebudd.local"
echo "    Password: admin123"
echo ""
echo "  [!] Change the admin password after first login!"
echo ""
