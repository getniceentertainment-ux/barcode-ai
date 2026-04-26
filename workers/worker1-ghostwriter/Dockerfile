# 1. Base Image: Official NVIDIA CUDA 11.8 (Lightweight, No PyTorch Bloat)
FROM nvidia/cuda:11.8.0-devel-ubuntu22.04

# 2. Prevent Linux from pausing the build for timezone questions
ENV DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# 3. Install Python, Build Tools, and libgomp1 (CRITICAL FOR RUNPOD)
RUN apt-get update && apt-get install -y python3 python3-pip git build-essential wget libgomp1

# 4. Map 'python' to 'python3' to prevent syntax confusion
RUN ln -s /usr/bin/python3 /usr/bin/python

# 5. Copy requirements
COPY requirements.txt .

# 6. THE 132 ERROR ASSASSIN: Download the pre-built cu118 wheel directly
# This entirely bypasses your PowerSpec CPU from compiling C++ code.
RUN pip3 install --no-cache-dir -r requirements.txt --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu118

# 7. DOWNLOAD SUPABASE INTEL DIRECTLY INTO THE IMAGE
RUN wget -O Daily_Briefing.txt "https://gdenckjxeutdcamnmdxp.supabase.co/storage/v1/object/public/matrix_intel/Daily_Briefing.txt"
RUN wget -O dictionary.json "https://gdenckjxeutdcamnmdxp.supabase.co/storage/v1/object/public/matrix_intel/Dictionary.json"
RUN wget -O master_index.json "https://gdenckjxeutdcamnmdxp.supabase.co/storage/v1/object/public/matrix_intel/master_index.json"

# 8. Copy your handler logic
COPY handler.py .

# 9. Boot the server securely
CMD ["python3", "-u", "handler.py"]