"""AML Network Graph — Threat Intelligence API.

All graph computation is now powered by Neo4j native Cypher queries.
Python BFS has been completely removed.

Endpoints:
  GET  /aml/network-graph     — Account topology with risk metadata (React-Flow)
  GET  /aml/circular-trading  — Detect circular fund loops (structuring / smurfing)
"""

import logging

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services import neo4j_service

logger = logging.getLogger("sentinelclear.aml")

router = APIRouter(prefix="/aml", tags=["AML Intelligence"])


@router.get("/network-graph")
async def get_network_graph(
    hours: int = Query(default=168, ge=1, le=720, description="Lookback window in hours"),
    min_transfers: int = Query(default=1, ge=1, le=100, description="Min edges to include a node"),
):
    """Build an AML network graph from recent transfer activity.

    Powered by Neo4j native Cypher — returns nodes (accounts) and edges
    (fund flows) suitable for React-Flow rendering, with risk metadata.
    """
    try:
        return await neo4j_service.get_network_graph(
            hours=hours,
            min_transfers=min_transfers,
        )
    except RuntimeError:
        # Neo4j not connected — return empty graph
        logger.warning("Neo4j not available — returning empty network graph")
        return {
            "nodes": [], "edges": [], "clusters": [],
            "stats": {
                "total_accounts": 0, "total_flows": 0, "flagged_flows": 0,
                "total_volume": 0, "high_risk_nodes": 0,
            },
        }


@router.get("/circular-trading")
async def detect_circular_trading(
    hours: int = Query(default=168, ge=1, le=720, description="Lookback window in hours"),
    min_loop: int = Query(default=3, ge=3, le=8, description="Minimum loop length"),
    max_loop: int = Query(default=6, ge=3, le=10, description="Maximum loop length"),
):
    """Detect circular fund flows (A→B→C→…→A) using Neo4j graph traversal.

    Identifies potential structuring, smurfing, or money mule chains
    by finding cycles in the transaction graph. Returns loops sorted
    by risk score (highest first).
    """
    try:
        loops = await neo4j_service.detect_circular_trading(
            hours=hours,
            min_loop_length=min_loop,
            max_loop_length=max_loop,
        )
        return {
            "loops": loops,
            "total_detected": len(loops),
            "critical_count": sum(1 for l in loops if l["threat_level"] == "CRITICAL"),
            "elevated_count": sum(1 for l in loops if l["threat_level"] == "ELEVATED"),
        }
    except RuntimeError:
        logger.warning("Neo4j not available — circular trading detection unavailable")
        return {
            "loops": [],
            "total_detected": 0,
            "critical_count": 0,
            "elevated_count": 0,
        }
