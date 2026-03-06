# Base image: Python 3.10 on Debian/Ubuntu (Bullseye)
FROM python:3.10-slim-bullseye

# Install system-level audio decoders and build tools
# Essentia REQUIRES ffmpeg and libav to decode mp3/wav files
RUN apt-get update && apt-get install -y \
    build-essential \
    ffmpeg \
    libavcodec-dev \
    libavformat-dev \
    libavutil-dev \
    libswresample-dev \
    libavresample-dev \
    libsamplerate0-dev \
    libtag1-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python requirements (This will compile Essentia bindings)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the handler
COPY handler.py .

# Start the RunPod serverless handler
CMD ["python", "-u", "handler.py"]