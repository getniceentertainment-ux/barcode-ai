# STAGE 1: THE BUILDER (The Crane)
FROM nvidia/cuda:11.8.0-devel-ubuntu22.04 AS builder

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y python3 python3-pip git build-essential cmake ninja-build

# Force the modern GPU build
ENV CMAKE_ARGS="-DGGML_CUDA=on -DGGML_NATIVE=off"
ENV FORCE_CMAKE=1

# REMOVED the ==0.2.75 lock. Let it grab the newest architecture.
# Putting the lock back so the build succeeds like it used to
RUN pip3 install --no-cache-dir llama-cpp-python==0.2.75

# STAGE 2: THE RUNTIME (The Finished House)
FROM nvidia/cuda:11.8.0-runtime-ubuntu22.04

WORKDIR /app

# Install only what we need to run the code
RUN apt-get update && apt-get install -y python3 python3-pip wget libgomp1 && \
    ln -s /usr/bin/python3 /usr/bin/python

# Copy the pre-compiled 'speed engine' from the builder
COPY --from=builder /usr/local/lib/python3.10/dist-packages /usr/local/lib/python3.10/dist-packages

# Copy requirements (minus llama-cpp since we just moved the finished version)
COPY requirements.txt .
RUN pip3 install --no-cache-dir runpod huggingface-hub

# Download Supabase Intel
RUN wget -O Daily_Briefing.txt "https://gdenckjxeutdcamnmdxp.supabase.co/storage/v1/object/public/matrix_intel/Daily_Briefing.txt" && \
    wget -O dictionary.json "https://gdenckjxeutdcamnmdxp.supabase.co/storage/v1/object/public/matrix_intel/Dictionary.json" && \
    wget -O master_index.json "https://gdenckjxeutdcamnmdxp.supabase.co/storage/v1/object/public/matrix_intel/master_index.json"

COPY handler.py .

CMD ["python3", "-u", "handler.py"]