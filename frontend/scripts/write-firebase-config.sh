#!/bin/sh
# Write public Firebase web config for the SPA (HF runtime secrets → static JSON).
set -e
export FIREBASE_DIST="${1:-frontend/dist}"
mkdir -p "$FIREBASE_DIST"

python3 <<'PY'
import json
import os
from pathlib import Path

dist = Path(os.environ.get("FIREBASE_DIST", "frontend/dist"))
keys = {
    "apiKey": os.environ.get("VITE_FIREBASE_API_KEY"),
    "authDomain": os.environ.get("VITE_FIREBASE_AUTH_DOMAIN"),
    "projectId": os.environ.get("VITE_FIREBASE_PROJECT_ID"),
    "storageBucket": os.environ.get("VITE_FIREBASE_STORAGE_BUCKET"),
    "messagingSenderId": os.environ.get("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    "appId": os.environ.get("VITE_FIREBASE_APP_ID"),
}
mid = os.environ.get("VITE_FIREBASE_MEASUREMENT_ID")
if mid:
    keys["measurementId"] = mid

if not all(keys.get(k) for k in ("apiKey", "authDomain", "projectId", "storageBucket", "messagingSenderId", "appId")):
    out = dist / "firebase-config.json"
    if out.exists():
        out.unlink()
    print("ℹ️  Firebase web config incomplete — Google sign-in disabled (email/password still works).")
else:
    dist.mkdir(parents=True, exist_ok=True)
    (dist / "firebase-config.json").write_text(json.dumps(keys), encoding="utf-8")
    print(f"✅ Wrote {dist / 'firebase-config.json'} for Firebase web auth")
PY
