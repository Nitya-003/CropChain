#!/bin/bash
set -e

echo "🚀 Starting CropChain AWS Deployment (Free-Tier EC2 + Docker Compose)..."

# Read user interactive variables
if [ -z "$ETH_PRIVATE_KEY" ]; then
    echo "⚠️  ETH_PRIVATE_KEY environment variable is not set. Reading from interactive shell..."
    read -sp "Enter your Ethereum Private Key (Sepolia): " ETH_PRIVATE_KEY
    echo ""
fi

# Load Cloudflare token if present
if [ -z "$CLOUDFLARE_TUNNEL_TOKEN" ]; then
    read -sp "Enter your Cloudflare Tunnel Token (optional, press Enter to skip): " CLOUDFLARE_TUNNEL_TOKEN
    echo ""
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

# Create .env file for docker-compose interpolation
cat <<EOT > .env
ETH_PRIVATE_KEY=$ETH_PRIVATE_KEY
GEMINI_API_KEY=$GEMINI_API_KEY
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

echo "🎉 AWS Backend Service deployed successfully!"
echo "📡 Access API directly: http://$EC2_PUBLIC_IP:3001"
echo "📊 Health Check endpoint: http://$EC2_PUBLIC_IP:3001/api/health"
