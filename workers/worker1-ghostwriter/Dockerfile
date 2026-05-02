# THE UNIFIED GPU ENVIRONMENT
FROM nvidia/cuda:11.8.0-devel-ubuntu22.04

ENV DEBIAN_FRONTEND=noninteractive
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y python3 python3-pip git build-essential cmake ninja-build wget libgomp1
RUN ln -s /usr/bin/python3 /usr/bin/python || true

# Force the modern GPU build
ENV CMAKE_ARGS="-DGGML_CUDA=on -DGGML_NATIVE=off"
ENV FORCE_CMAKE=1

# 🚨 THE ULTIMATE CUDA STUB FIX (Build Phase): 
# Set LD_LIBRARY_PATH so the compiler can't "forget" where the stubs are on step 393
RUN ln -s /usr/local/cuda/lib64/stubs/libcuda.so /usr/local/cuda/lib64/stubs/libcuda.so.1 || true
ENV LD_LIBRARY_PATH="/usr/local/cuda/lib64/stubs:${LD_LIBRARY_PATH}"
ENV LDFLAGS="-L/usr/local/cuda/lib64/stubs"

# Install Python dependencies
COPY requirements.txt .
RUN python3 -m pip install --no-cache-dir --upgrade pip
RUN python3 -m pip install --no-cache-dir --upgrade llama-cpp-python
RUN python3 -m pip install --no-cache-dir runpod huggingface-hub

# Download Supabase Intel
RUN wget -O Daily_Briefing.txt "https://gdenckjxeutdcamnmdxp.supabase.co/storage/v1/object/public/matrix_intel/Daily_Briefing.txt" && \
    wget -O dictionary.json "https://gdenckjxeutdcamnmdxp.supabase.co/storage/v1/object/public/matrix_intel/Dictionary.json" && \
    wget -O master_index.json "https://gdenckjxeutdcamnmdxp.supabase.co/storage/v1/object/public/matrix_intel/master_index.json"

# 🚨 THE RUNTIME CLEANUP (Crucial for RunPod):
# Delete the fake build-time GPU drivers and reset the path so RunPod can use the real RTX 4090
RUN rm -rf /usr/local/cuda/lib64/stubs
ENV LD_LIBRARY_PATH="/usr/local/nvidia/lib:/usr/local/nvidia/lib64"

# Move the code in
COPY handler.py .
COPY syl_ref.json .
COPY dictionary.json .
COPY master_index.json .
COPY Daily_Briefing.txt .

CMD ["python3", "-u", "handler.py"]