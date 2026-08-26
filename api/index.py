from __future__ import annotations
import sys
from pathlib import Path

# Add project root and backend to sys.path so imports resolve seamlessly on Vercel
root_dir = Path(__file__).resolve().parent.parent
backend_dir = root_dir / "backend"
sys.path.insert(0, str(root_dir))
sys.path.insert(0, str(backend_dir))

from backend.app.main import app
