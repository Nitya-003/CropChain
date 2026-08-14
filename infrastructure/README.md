# CropChain Infrastructure (Terraform)

This directory contains the Infrastructure as Code (IaC) configuration for deploying CropChain to AWS.

## Prerequisites

- Terraform >= 1.5.0
- AWS CLI configured with appropriate credentials (or exported environment variables)

## Usage

1. **Initialize Terraform**

   ```bash
   terraform init
   ```

2. **Configure Variables** (Optional)
   Copy the example variables file:

   ```bash
   cp terraform.tfvars.example terraform.tfvars
   ```

   Modify `terraform.tfvars` with your desired configuration.

3. **Format and Validate**

   ```bash
   terraform fmt
   terraform validate
   ```

4. **Review Changes**

   ```bash
   terraform plan
   ```

5. **Apply Infrastructure**

   ```bash
   terraform apply
   ```

## CI/CD Integration

GitHub Actions automatically runs `terraform fmt` and `terraform validate` on pull requests to ensure configuration correctness. State management (like S3 backend) should be configured depending on the project's remote state backend requirements.
