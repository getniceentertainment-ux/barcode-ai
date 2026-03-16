# Use RunPod's official PyTorch base image (CUDA optimized)
FROM runpod/pytorch:2.0.1-py3.10-cuda11.8.0-devel

WORKDIR /app

# Install OS-level dependencies required for Demucs audio processing
RUN apt-get update && apt-get install -y \
    ffmpeg \
    libsndfile1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the GPU handler script
COPY handler.py .

# THE UPGRADE: Pre-download the cleaner Kim_Vocal_2 model for blazing fast cold-boots
RUN python -c "from audio_separator.separator import Separator; sep = Separator(); sep.load_model('Kim_Vocal_2.onnx')"

# Start the RunPod Serverless listener
CMD ["python", "-u", "handler.py"]