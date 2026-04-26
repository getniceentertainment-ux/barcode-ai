from huggingface_hub import HfApi
api = HfApi()
files = api.list_repo_files(repo_id="talo85/getnice", token="YOUR_HF_TOKEN")
print(files)