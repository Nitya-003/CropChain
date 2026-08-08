#!/bin/bash
set -euo pipefail

# ─── Security check ──────────────────────────────────────────────────────────
# Block deployment if PRIVATE_KEY is set directly — use AWS_SECRET_ARN instead.
if [[ -n "${PRIVATE_KEY:-}" ]]; then
  echo "[ERROR] PRIVATE_KEY is set as an environment variable."
  echo "        This is not permitted in production deployments."
  echo "        Store your key in AWS Secrets Manager and set AWS_SECRET_ARN instead."
  exit 1
fi

if [[ -z "${AWS_SECRET_ARN:-}" ]]; then
  echo "[ERROR] AWS_SECRET_ARN is not set."
  echo "        Set it to your Secrets Manager ARN before deploying."
  exit 1
fi
echo "[OK] Key management check passed — using AWS Secrets Manager."
# ─────────────────────────────────────────────────────────────────────────────


set -e

echo "🚀 Starting CropChain AWS Deployment (Free-Tier EC2 + Docker Compose)..."

# Read user interactive variables
# Signing credentials: an ENCRYPTED keystore is strongly preferred
# (ETH_KEYSTORE_JSON = base64 of the Web3 Secret Storage JSON, plus
# WALLET_KEYSTORE_PASSWORD). The plaintext ETH_PRIVATE_KEY path is deprecated
# and only kept for backward compatibility.
if [ -z "$WALLET_KEYSTORE_PASSWORD" ] && [ -z "$ETH_KEYSTORE_JSON" ] && [ -z "$ETH_PRIVATE_KEY" ]; then
    if [ "$CI" = "true" ]; then
        ETH_PRIVATE_KEY="dummy_private_key_for_ci_builds_00000000000000000000000000"
    else
        # echo "⚠️  ETH_PRIVATE_KEY environment variable is not set. Reading from interactive shell..."
        read -sp "Enter your Ethereum Private Key (Sepolia): " ETH_PRIVATE_KEY
        echo "⚠️  No blockchain signing credentials set."
        echo "    Recommended: export ETH_KEYSTORE_JSON=\"\$(base64 -w0 keystore.json)\""
        echo "    Recommended: export WALLET_KEYSTORE_PASSWORD=\"...\""
        echo "    (Deprecated) export ETH_PRIVATE_KEY=0x... stores the key in plaintext."
        read -sp "Enter your Ethereum private key (only if not using an encrypted keystore): " ETH_PRIVATE_KEY
        echo ""
    fi
fi

# Load Cloudflare token if present
if [ -z "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
    if [ "$CI" != "true" ]; then
        read -sp "Enter your Cloudflare Tunnel Token (optional, press Enter to skip): " CLOUDFLARE_TUNNEL_TOKEN
        echo ""
    fi
fi

# Load JWT/HMAC secrets or generate them if they are not set
if [ -z "$JWT_SECRET" ]; then
    echo "🔑 JWT_SECRET environment variable is not set. Generating a secure random secret..."
    JWT_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || openssl rand -hex 32 2>/dev/null || echo "fallback_jwt_secret_must_change_1234567890")
fi

if [ -z "$JWT_REFRESH_SECRET" ]; then
    echo "🔑 JWT_REFRESH_SECRET environment variable is not set. Generating a secure random secret..."
    JWT_REFRESH_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || openssl rand -hex 32 2>/dev/null || echo "fallback_jwt_refresh_secret_must_change_1234567890")
fi

if [ -z "$MULTISIG_HMAC_SECRET" ]; then
    echo "🔑 MULTISIG_HMAC_SECRET environment variable is not set. Generating a secure random secret..."
    MULTISIG_HMAC_SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || openssl rand -hex 32 2>/dev/null || echo "fallback_multisig_hmac_secret_must_change_1234567890")
fi

if [ -z "$ML_API_KEY" ]; then
    echo "🔑 ML_API_KEY environment variable is not set. Generating a secure random secret..."
    ML_API_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" 2>/dev/null || openssl rand -hex 32 2>/dev/null || echo "fallback_ml_api_key_must_change_1234567890")
fi

# 1. AWS Account ID & Bucket Name
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
BUCKET_NAME="cropchain-deploy-$ACCOUNT_ID"

echo "📦 Setting up deployment bucket: $BUCKET_NAME..."
if ! aws s3api head-bucket --bucket "$BUCKET_NAME" 2>/dev/null; then
    aws s3 mb "s3://$BUCKET_NAME" --region us-east-1
    echo "✅ S3 Bucket created successfully"
else
    echo "ℹ️  S3 Bucket already exists"
fi

# 2. Package codebase
echo "📦 Archiving codebase..."
tar --exclude='node_modules' --exclude='.env' --exclude='.git' -czf repo.tar.gz .
aws s3 cp repo.tar.gz "s3://$BUCKET_NAME/repo.tar.gz"
rm repo.tar.gz
echo "✅ Codebase archive uploaded to S3"

# 3. Deploy CloudFormation Stack
echo "🛠️  Deploying CloudFormation stack 'cropchain-infra'..."
aws cloudformation deploy \
    --stack-name cropchain-infra \
    --template-file cropchain-stack.yaml \
    --capabilities CAPABILITY_IAM \
    --region us-east-1

echo "✅ CloudFormation stack deployed successfully!"

# 4. Get outputs
echo "🔍 Fetching stack outputs..."
EC2_INSTANCE_ID=$(aws cloudformation describe-stacks --stack-name cropchain-infra --query "Stacks[0].Outputs[?OutputKey=='EC2InstanceId'].OutputValue" --output text)
EC2_PUBLIC_IP=$(aws cloudformation describe-stacks --stack-name cropchain-infra --query "Stacks[0].Outputs[?OutputKey=='EC2PublicIP'].OutputValue" --output text)

echo "   • EC2 Instance ID: $EC2_INSTANCE_ID"
echo "   • EC2 Public IP: $EC2_PUBLIC_IP"

# 5. Wait for EC2 instance to register in SSM
echo "⏳ Waiting for EC2 instance to be ready in AWS Systems Manager (SSM)..."
while true; do
    INSTANCE_STATUS=$(aws ssm describe-instance-information --filters "Key=InstanceIds,Values=$EC2_INSTANCE_ID" --query "InstanceInformationList[0].PingStatus" --output text)
    if [ "$INSTANCE_STATUS" = "Online" ]; then
        echo "✅ EC2 instance is Online in Systems Manager!"
        break
    fi
    echo "   ... waiting for instance registration (takes ~1-2 minutes) ..."
    sleep 10
done

# 6. Run deployment commands on the EC2 instance via SSM
echo "💻 Configuring and starting backend service on EC2..."

# Run command script block
SSM_COMMANDS=$(cat <<EOF
#!/bin/bash
set -e
cd /home/ec2-user

# Wait for docker-compose to be installed
while [ ! -f /usr/local/bin/docker-compose ]; do
    echo "Waiting for Docker Compose installation..."
    sleep 5
done

# Download and extract code
aws s3 cp s3://$BUCKET_NAME/repo.tar.gz /home/ec2-user/repo.tar.gz
rm -rf CropChain
mkdir -p CropChain
tar -xzf repo.tar.gz -C CropChain
rm repo.tar.gz

cd CropChain

# Create .env file for docker-compose interpolation.
# The raw private key is NEVER written here — if an encrypted keystore is
# provided it is passed through as base64 (ETH_KEYSTORE_JSON) and decrypted at
# runtime by utils/keystore via Wallet.fromEncryptedJson.
cat <<EOT > .env
ETH_PRIVATE_KEY=$ETH_PRIVATE_KEY
WALLET_KEYSTORE_JSON=$ETH_KEYSTORE_JSON
WALLET_KEYSTORE_PASSWORD=$WALLET_KEYSTORE_PASSWORD
GEMINI_API_KEY=$GEMINI_API_KEY
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
MULTISIG_HMAC_SECRET=$MULTISIG_HMAC_SECRET
ML_API_KEY=$ML_API_KEY
EOT

# Start the stack using docker-compose
/usr/local/bin/docker-compose -f docker-compose.prod.yml down || true
/usr/local/bin/docker-compose -f docker-compose.prod.yml up -d --build

# Start Cloudflare Tunnel if token is provided
if [ ! -z "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
    docker stop cloudflared || true
    docker rm cloudflared || true
    docker run -d \
      --name cloudflared \
      --network host \
      --restart always \
      cloudflare/cloudflared:latest tunnel --no-autoupdate run --token "$CLOUDFLARE_TUNNEL_TOKEN"
fi
EOF
)

# Trigger SSM command execution
COMMAND_ID=$(aws ssm send-command \
    --instance-ids "$EC2_INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --parameters commands=["$SSM_COMMANDS"] \
    --query "Command.CommandId" \
    --output text)

echo "🛰️  Deployment command sent to EC2. Command ID: $COMMAND_ID"
echo "⏳ Monitoring command status (takes ~1-2 minutes for Docker build)..."

while true; do
    STATUS=$(aws ssm list-command-invocations --command-id "$COMMAND_ID" --details --query "CommandInvocations[0].Status" --output text)
    if [ "$STATUS" = "Success" ]; then
        echo "✅ Deployment completed successfully on EC2!"
        break
    elif [ "$STATUS" = "Failed" ] || [ "$STATUS" = "Cancelled" ] || [ "$STATUS" = "TimedOut" ]; then
        echo "❌ Deployment command failed with status: $STATUS"
        # Print logs
        aws ssm list-command-invocations --command-id "$COMMAND_ID" --details --query "CommandInvocations[0].CommandPlugins[0].Output" --output text
        exit 1
    fi
    sleep 10
done

echo "⏳ Running Post-Deployment Health Checks..."
MAX_RETRIES=12
RETRY_COUNT=0
HEALTHY=false

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    echo "   ... Checking services (Attempt $((RETRY_COUNT+1))/$MAX_RETRIES)"
    BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://$EC2_PUBLIC_IP:3001/api/health || echo "000")
    ML_STATUS=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 http://$EC2_PUBLIC_IP:5001/health || echo "000")
    
    if [ "$BACKEND_STATUS" = "200" ] && [ "$ML_STATUS" = "200" ]; then
        echo "✅ All required services are healthy!"
        HEALTHY=true
        break
    fi
    
    echo "   ... Backend HTTP Status: $BACKEND_STATUS"
    echo "   ... ML Service HTTP Status: $ML_STATUS"
    echo "   ... Retrying in 10 seconds..."
    sleep 10
    RETRY_COUNT=$((RETRY_COUNT+1))
done

if [ "$HEALTHY" = "false" ]; then
    echo "❌ Post-Deployment Health Check Failed! Services are not reachable."
    exit 1
fi

echo "🎉 AWS Backend Service deployed successfully!"
echo "📡 Access API directly: http://$EC2_PUBLIC_IP:3001"
echo "📊 Health Check endpoint: http://$EC2_PUBLIC_IP:3001/api/health"
echo "🤖 ML Service endpoint: http://$EC2_PUBLIC_IP:5001"
