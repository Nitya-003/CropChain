#!/bin/sh
set -e

CERT_DIR="/etc/nginx/certs"
CERT_FILE="${CERT_DIR}/fullchain.pem"
KEY_FILE="${CERT_DIR}/privkey.pem"

# Create cert directory if it doesn't exist
mkdir -p "$CERT_DIR"

# Generate a self-signed certificate if one doesn't exist
if [ ! -f "$CERT_FILE" ] || [ ! -f "$KEY_FILE" ]; then
    echo "⚠️  SSL certificates not found in ${CERT_DIR}. Generating self-signed fallback certificates..."

    # Generate private key and self-signed certificate
    openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
        -keyout "$KEY_FILE" \
        -out "$CERT_FILE" \
        -subj "/C=US/ST=State/L=City/O=CropChain/OU=DevOps/CN=localhost"

    echo "✅ Self-signed SSL certificates generated successfully."
else
    echo "✅ SSL certificates found. Using existing certificates."
fi

# Run the original Nginx entrypoint command (which is passed as args)
exec "$@"
