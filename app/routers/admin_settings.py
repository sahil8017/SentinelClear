from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel, ConfigDict
from typing import Optional, Any

from app.database import get_db, get_read_db
from app.models import SystemConfig, User
from app.dependencies import require_admin

router = APIRouter(prefix="/admin/settings", tags=["Admin Settings"])

class SystemConfigOut(BaseModel):
    key: str
    value_type: str
    value: str
    description: Optional[str] = None
    
    model_config = ConfigDict(from_attributes=True)

class SystemConfigUpdate(BaseModel):
    key: str
    value: str

# Default settings map so the database gets seeded if missing
DEFAULT_SYSTEM_SETTINGS = {
    # UPI Safety Thresholds
    "UPI_PAUSE_THRESHOLD": {"value": "10000", "type": "int", "description": "Amount threshold to trigger 15-minute pause (INR)"},
    "UPI_ANNUAL_RECEIVING_LIMIT": {"value": "2500000", "type": "int", "description": "Annual incoming limit for accounts (INR)"},
    "VULNERABLE_AGE_THRESHOLD": {"value": "70", "type": "int", "description": "Age at which vulnerable group protections apply"},
    
    # Transfer Limits
    "MAKER_CHECKER_THRESHOLD": {"value": "200000", "type": "int", "description": "Transactions above this require manual approval (INR)"},
    "DAILY_VELOCITY_LIMIT": {"value": "20", "type": "int", "description": "Max outbound transfers per day"},
    "NEW_BENEFICIARY_CAP_24H": {"value": "50000", "type": "int", "description": "Transfer limit to new beneficiaries in first 24h (INR)"},

    # Fraud Tiers
    "FRAUD_REVIEW_THRESHOLD": {"value": "0.4", "type": "float", "description": "Risk score (0-1) triggering flagged warning"},
    "FRAUD_BLOCK_THRESHOLD": {"value": "0.7", "type": "float", "description": "Risk score (0-1) triggering hard block"},
}

async def get_system_setting(db: AsyncSession, key: str) -> Any:
    """Helper to fetch a setting at runtime, with fallback to default."""
    res = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
    conf = res.scalar_one_or_none()
    
    if not conf:
        if key not in DEFAULT_SYSTEM_SETTINGS:
            return None
        
        # Auto-seed
        default = DEFAULT_SYSTEM_SETTINGS[key]
        conf = SystemConfig(
            key=key,
            value=default["value"],
            value_type=default["type"],
            description=default["description"]
        )
        db.add(conf)
        await db.commit()
        await db.refresh(conf)
        
    if conf.value_type == "int":
        return int(conf.value)
    elif conf.value_type == "float":
        return float(conf.value)
    elif conf.value_type == "bool":
        return conf.value.lower() == "true"
    return conf.value

@router.get("", response_model=list[SystemConfigOut])
async def get_all_settings(
    db: AsyncSession = Depends(get_db),
    admin_role: str = Depends(require_admin),
):
    # Ensure all defaults exist
    for key, opts in DEFAULT_SYSTEM_SETTINGS.items():
        res = await db.execute(select(SystemConfig).where(SystemConfig.key == key))
        if not res.scalar_one_or_none():
            db.add(SystemConfig(key=key, value=opts["value"], value_type=opts["type"], description=opts["description"]))
    await db.commit()

    res = await db.execute(select(SystemConfig).order_by(SystemConfig.key))
    return res.scalars().all()

@router.put("", response_model=SystemConfigOut)
async def update_setting(
    body: SystemConfigUpdate,
    db: AsyncSession = Depends(get_db),
    admin_role: str = Depends(require_admin),
):
    res = await db.execute(select(SystemConfig).where(SystemConfig.key == body.key))
    conf = res.scalar_one_or_none()
    if not conf:
        raise HTTPException(status_code=404, detail="Setting not found")
        
    conf.value = body.value
    await db.commit()
    await db.refresh(conf)
    return conf
