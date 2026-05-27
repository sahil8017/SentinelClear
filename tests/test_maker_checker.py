"""Quick isolated test for the Maker-Checker flow."""
import requests, os, uuid, asyncio, asyncpg

BASE = "http://localhost:8000/api/v1"
PASSWORD = "securepass123"
uid = uuid.uuid4().hex[:6]
ALICE = f"mc_alice_{uid}"
BOB = f"mc_bob_{uid}"

async def set_kyc(username):
    db_url = os.environ.get(
        "DATABASE_URL",
        "postgresql+asyncpg://sentinel:sentinel_secret_2024@localhost:5432/sentinelclear"
    ).replace("+asyncpg", "")
    conn = await asyncpg.connect(db_url)
    await conn.execute("UPDATE users SET kyc_status = 'PAN_VERIFIED' WHERE username = $1", username)
    await conn.close()

# Register + login Alice
requests.post(f"{BASE}/auth/register", json={"username": ALICE, "email": f"{ALICE}@t.com", "password": PASSWORD})
r = requests.post(f"{BASE}/auth/login", json={"username": ALICE, "password": PASSWORD})
a_token = r.json()["access_token"]
a_h = {"Authorization": f"Bearer {a_token}"}

# KYC verify Alice so PAN_MANDATE doesn't block
asyncio.run(set_kyc(ALICE))

# Register + login Bob
requests.post(f"{BASE}/auth/register", json={"username": BOB, "email": f"{BOB}@t.com", "password": PASSWORD})
r = requests.post(f"{BASE}/auth/login", json={"username": BOB, "password": PASSWORD})
b_token = r.json()["access_token"]
b_h = {"Authorization": f"Bearer {b_token}"}

# Get primary auto-provisioned accounts (these are the ones seeded by occupation)
r = requests.get(f"{BASE}/accounts/me", headers=a_h)
a_acct = r.json()["id"]
r = requests.get(f"{BASE}/accounts/me", headers=b_h)
b_acct = r.json()["id"]

# Seed Alice as "Business Owner" → ₹10,00,000 (₹10 Lakh) via occupation-based seeding
r = requests.patch(f"{BASE}/auth/profile", json={"occupation": "Business Owner"}, headers=a_h)
print(f"Occupation seed: {r.status_code}")

# Maker-Checker transfer (600k > 500k threshold)
r_mc = requests.post(f"{BASE}/transfers", json={
    "sender_account_id": a_acct,
    "receiver_account_id": b_acct,
    "amount": 600000,
}, headers={**a_h, "Idempotency-Key": str(uuid.uuid4())})

print(f"Transfer status: {r_mc.status_code}")
print(f"Transfer body: {r_mc.text}")
