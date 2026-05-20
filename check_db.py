import asyncio
import json
from decimal import Decimal
from app.database import AsyncSessionLocal
from app.models import Transfer
from sqlalchemy import select

async def main():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Transfer).limit(5))
        transfers = result.scalars().all()
        for t in transfers:
            print(f"Transfer ID: {t.id}, Amount: {t.amount}, Type: {type(t.amount)}")

asyncio.run(main())
