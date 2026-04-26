# Base image: Ubuntu 22.04 with CUDA 11.8
FROM runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04

WORKDIR /app

# Install Python, build tools, and the CRITICAL libgomp1 threading library
RUN apt-get update && apt-get install -y python3 python3-pip git build-essential wget libgomp1
# Copy requirements
COPY requirements.txt .

# Install requirements (llama-cpp-python will compile for the GPU here)
RUN pip install --no-cache-dir -r requirements.txt --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu118

# --- DOWNLOAD SUPABASE INTEL DIRECTLY INTO THE IMAGE ---
RUN wget -O Daily_Briefing.txt "https://gdenckjxeutdcamnmdxp.supabase.co/storage/v1/object/public/matrix_intel/Daily_Briefing.txt"
RUN wget -O dictionary.json "https://gdenckjxeutdcamnmdxp.supabase.co/storage/v1/object/public/matrix_intel/Dictionary.json"
RUN wget -O master_index.json "https://gdenckjxeutdcamnmdxp.supabase.co/storage/v1/object/public/matrix_intel/master_index.json"

# Copy ONLY code files to keep the image light
# If you use a Network Volume for the .gguf, DO NOT include the .gguf in this folder
COPY handler.py .

CMD ["python3", "-u", "handler.py"]