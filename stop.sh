#!/bin/bash
set -e

echo "Stopping File Storage services..."

cd "$(dirname "$0")"
docker compose down

echo "All services stopped."
