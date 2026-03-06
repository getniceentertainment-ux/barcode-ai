# Base image: Ubuntu 22.04 with PyTorch and CUDA 11.8
FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y git build-essential

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy all worker files
COPY . .

# Warm up the model (Deep Burn-In) by running the handler once on build (Optional, but recommended for faster cold starts)
# RUN python -c "from handler import init_model; init_model()"

# Start the RunPod serverless handler
CMD ["python", "-u", "handler.py"]