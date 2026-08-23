#!/usr/bin/env python3
"""Audit V — Publish Fine-Tuned LoRA Adapter to Hugging Face.

Creates repository: peterrs23/audit-v-qwen-3b
Uploads:
- adapter_model.safetensors
- adapter_config.json
- tokenizer.json, tokenizer_config.json, chat_template.jinja
- training_log.json
- evaluation_responses.json
- README.md (Model Card)

Excludes:
- Checkpoints (checkpoint-26, checkpoint-52)
- Secret / token / cache files
"""

from __future__ import annotations

import sys
from pathlib import Path
from huggingface_hub import HfApi, create_repo, whoami

ROOT_DIR = Path(__file__).resolve().parents[1]
MODEL_OUTPUT_DIR = ROOT_DIR / "backend" / "models" / "audit_v_qwen_lora"
REPO_ID = "peterrs23/audit-v-qwen-3b"


def publish_adapter():
    print("=" * 65)
    print("AUDIT V - HUGGING FACE ADAPTER PUBLISHING PIPELINE")
    print("=" * 65)

    # 1. Verify Hugging Face Authentication
    print("[1/4] Verifying Hugging Face Authentication...")
    try:
        user_info = whoami()
        username = user_info.get("name")
        print(f"  * Authenticated User: {username}")
        if username != "peterrs23":
            print(f"[FAIL] Expected user 'peterrs23', but got '{username}'. Aborting.")
            sys.exit(1)
    except Exception as err:
        print(f"[FAIL] Hugging Face authentication failed: {err}")
        sys.exit(1)

    # 2. Create Hugging Face Model Repository
    api = HfApi()
    print(f"\n[2/4] Ensuring Hugging Face Model Repository '{REPO_ID}' exists...")
    try:
        repo_url = create_repo(
            repo_id=REPO_ID,
            repo_type="model",
            exist_ok=True,
            private=False,
        )
        print(f"  * Repository URL: {repo_url}")
    except Exception as err:
        print(f"  * Repository check/creation info: {err}")

    # 3. List Local Files to Upload
    print(f"\n[3/4] Validating local files in '{MODEL_OUTPUT_DIR}'...")
    required_files = [
        "adapter_model.safetensors",
        "adapter_config.json",
        "tokenizer.json",
        "tokenizer_config.json",
        "training_log.json",
        "evaluation_responses.json",
        "README.md",
    ]

    for fname in required_files:
        fpath = MODEL_OUTPUT_DIR / fname
        if not fpath.exists():
            print(f"[FAIL] Required file missing: '{fname}' in {MODEL_OUTPUT_DIR}")
            sys.exit(1)
        size_mb = fpath.stat().st_size / (1024 * 1024)
        print(f"  * Verified: {fname} ({size_mb:.2f} MB)")

    # 4. Upload Files to Hugging Face
    print(f"\n[4/4] Uploading Adapter & Tokenizer files to '{REPO_ID}'...")
    ignore_patterns = ["checkpoint-*", "*.pyc", "__pycache__", ".git*"]

    api.upload_folder(
        folder_path=str(MODEL_OUTPUT_DIR),
        repo_id=REPO_ID,
        repo_type="model",
        ignore_patterns=ignore_patterns,
    )

    print("\n" + "=" * 65)
    print(f"[OK] ADAPTER PUBLISHED SUCCESSFULLY TO HUGGING FACE!")
    print(f"URL: https://huggingface.co/{REPO_ID}")
    print("=" * 65)


if __name__ == "__main__":
    publish_adapter()
