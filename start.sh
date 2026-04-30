#!/bin/bash
set -e

echo "Starting File Storage with OnlyOffice..."

# Create directories
mkdir -p /var/lib/app-file-storage
mkdir -p /var/log/app-file-storage

# Start services
cd "$(dirname "$0")"
docker compose up -d

echo ""
echo "Services started:"
echo "  Application:  http://localhost"
echo "  OnlyOffice:   http://localhost/onlyoffice"
echo ""
echo "Logs:"
docker compose logs -f
