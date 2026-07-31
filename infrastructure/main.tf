# ==================== VPC & NETWORKING ====================
resource "aws_vpc" "cropchain_vpc" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true
  tags = merge(var.common_tags, {
    Name = "${var.project_name}-vpc"
  })
}

resource "aws_internet_gateway" "cropchain_igw" {
  vpc_id = aws_vpc.cropchain_vpc.id
  tags = merge(var.common_tags, {
    Name = "${var.project_name}-igw"
  })
}

data "aws_availability_zones" "available" {
  state = "available"
}

resource "aws_subnet" "cropchain_public_subnet" {
  vpc_id                  = aws_vpc.cropchain_vpc.id
  cidr_block              = var.public_subnet_cidr
  availability_zone       = data.aws_availability_zones.available.names[0]
  map_public_ip_on_launch = true
  tags = merge(var.common_tags, {
    Name = "${var.project_name}-public-subnet"
  })
}

resource "aws_route_table" "cropchain_public_rt" {
  vpc_id = aws_vpc.cropchain_vpc.id
  tags = merge(var.common_tags, {
    Name = "${var.project_name}-public-rt"
  })
}

resource "aws_route" "public_route" {
  route_table_id         = aws_route_table.cropchain_public_rt.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.cropchain_igw.id
}

resource "aws_route_table_association" "public_subnet_assoc" {
  subnet_id      = aws_subnet.cropchain_public_subnet.id
  route_table_id = aws_route_table.cropchain_public_rt.id
}

# ==================== SECURITY GROUP ====================
resource "aws_security_group" "cropchain_sg" {
  name        = "${var.project_name}-sg"
  description = "Security group for CropChain EC2 instance"
  vpc_id      = aws_vpc.cropchain_vpc.id

  ingress {
    description = "Allow backend API traffic"
    from_port   = 3001
    to_port     = 3001
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    description = "Allow all outbound traffic"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-sg"
  })
}

# ==================== IAM ROLE & INSTANCE PROFILE ====================
resource "aws_iam_role" "ec2_ssm_role" {
  name = "${var.project_name}-ec2-ssm-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ssm_managed_instance_core" {
  role       = aws_iam_role.ec2_ssm_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_role_policy_attachment" "s3_readonly_access" {
  role       = aws_iam_role.ec2_ssm_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"
}

resource "aws_iam_instance_profile" "ec2_instance_profile" {
  name = "${var.project_name}-ec2-profile"
  role = aws_iam_role.ec2_ssm_role.name
}

# ==================== EC2 INSTANCE ====================
data "aws_ami" "amazon_linux_2023" {
  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-x86_64"]
  }
}

resource "aws_instance" "backend_server" {
  ami                  = data.aws_ami.amazon_linux_2023.id
  instance_type        = var.instance_type
  subnet_id            = aws_subnet.cropchain_public_subnet.id
  iam_instance_profile = aws_iam_instance_profile.ec2_instance_profile.name
  vpc_security_group_ids = [aws_security_group.cropchain_sg.id]

  user_data = base64encode(<<-EOF
    #!/bin/bash
    dnf update -y
    dnf install -y docker git
    systemctl start docker
    systemctl enable docker
    # Install Docker Compose
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
  EOF
  )

  tags = merge(var.common_tags, {
    Name = "${var.project_name}-backend-server"
  })
}
