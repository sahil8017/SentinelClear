"""AML Network Graph — Threat Intelligence API.

Computes a transfer adjacency graph from recent transaction data,
identifies high-risk clusters (money-mule chains), and returns
nodes + edges for the React-Flow frontend visualization.
"""

import logging
from collections import defaultdict
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Transfer, Account, User

logger = logging.getLogger("sentinelclear.aml")

router = APIRouter(prefix="/aml", tags=["AML Intelligence"])


def _risk_color(score: float) -> str:
    """Map a risk score to a hex color for the graph node."""
    if score >= 0.7:
        return "#ef4444"   # Red — high risk
    if score >= 0.4:
        return "#f59e0b"   # Amber — medium risk
    return "#10b981"       # Green — safe


@router.get("/network-graph")
async def get_network_graph(
    hours: int = Query(default=168, ge=1, le=720, description="Lookback window in hours"),
    min_transfers: int = Query(default=1, ge=1, le=100, description="Min edges to include a node"),
    db: AsyncSession = Depends(get_db),
):
    """Build an AML network graph from recent transfer activity.

    Returns nodes (accounts) and edges (fund flows) suitable for
    React-Flow rendering, with risk metadata for each node.
    """
    cutoff = datetime.utcnow() - timedelta(hours=hours)

    # ── Pull all transfers in the lookback window ──
    result = await db.execute(
        select(
            Transfer.sender_account_id,
            Transfer.receiver_account_id,
            Transfer.amount,
            Transfer.risk_score,
            Transfer.ml_risk_score,
            Transfer.status,
            Transfer.created_at,
        ).where(Transfer.created_at >= cutoff)
        .order_by(Transfer.created_at.asc())
    )
    transfers = result.all()

    if not transfers:
        return {"nodes": [], "edges": [], "clusters": [], "stats": {
            "total_accounts": 0, "total_flows": 0, "flagged_flows": 0,
            "total_volume": 0, "high_risk_nodes": 0,
        }}

    # ── Build adjacency structures ──
    account_ids = set()
    edge_map = defaultdict(lambda: {"count": 0, "total_amount": 0.0, "max_risk": 0.0, "flagged": 0})
    account_risk = defaultdict(lambda: {"max_risk": 0.0, "total_out": 0.0, "total_in": 0.0, "tx_count": 0, "flagged": 0})

    for t in transfers:
        sender, receiver, amount, risk, ml_risk, status, created = t
        account_ids.add(sender)
        account_ids.add(receiver)

        edge_key = (sender, receiver)
        edge_map[edge_key]["count"] += 1
        edge_map[edge_key]["total_amount"] += amount
        edge_map[edge_key]["max_risk"] = max(edge_map[edge_key]["max_risk"], risk or 0)
        if status == "FLAGGED":
            edge_map[edge_key]["flagged"] += 1

        account_risk[sender]["total_out"] += amount
        account_risk[sender]["tx_count"] += 1
        account_risk[sender]["max_risk"] = max(account_risk[sender]["max_risk"], risk or 0)
        if status == "FLAGGED":
            account_risk[sender]["flagged"] += 1

        account_risk[receiver]["total_in"] += amount
        account_risk[receiver]["tx_count"] += 1

    # ── Fetch account owner names for labels ──
    owner_map = {}
    if account_ids:
        acct_result = await db.execute(
            select(Account.id, User.username)
            .join(User, Account.owner_id == User.id)
            .where(Account.id.in_(list(account_ids)))
        )
        for acct_id, username in acct_result.all():
            owner_map[acct_id] = username

    # ── Filter by min_transfers ──
    active_accounts = {aid for aid in account_ids if account_risk[aid]["tx_count"] >= min_transfers}

    # ── Build React-Flow nodes ──
    nodes = []
    COLS = 4
    for idx, acct_id in enumerate(sorted(active_accounts)):
        info = account_risk[acct_id]
        risk_val = info["max_risk"]
        label = owner_map.get(acct_id, acct_id[:8])
        is_flagged = info["flagged"] > 0

        # Circular/grid layout
        col = idx % COLS
        row = idx // COLS
        x = 100 + col * 280
        y = 100 + row * 200

        nodes.append({
            "id": acct_id,
            "type": "default",
            "position": {"x": x, "y": y},
            "data": {
                "label": label,
                "risk_score": round(risk_val, 4),
                "total_out": round(info["total_out"], 2),
                "total_in": round(info["total_in"], 2),
                "tx_count": info["tx_count"],
                "flagged": info["flagged"],
                "is_flagged": is_flagged,
            },
            "style": {
                "background": _risk_color(risk_val),
                "color": "#fff",
                "border": "2px solid #ef4444" if is_flagged else "1px solid rgba(255,255,255,0.2)",
                "borderRadius": "12px",
                "padding": "10px",
                "fontSize": "11px",
                "fontWeight": "bold",
                "boxShadow": "0 0 20px rgba(239,68,68,0.5)" if is_flagged else "none",
            },
        })

    # ── Build React-Flow edges ──
    edges = []
    for (src, dst), info in edge_map.items():
        if src not in active_accounts or dst not in active_accounts:
            continue
        is_hot = info["max_risk"] >= 0.7 or info["flagged"] > 0
        edges.append({
            "id": f"e-{src[:8]}-{dst[:8]}",
            "source": src,
            "target": dst,
            "animated": is_hot,
            "label": f"₹{info['total_amount']:,.0f} ({info['count']}x)",
            "style": {
                "stroke": "#ef4444" if is_hot else "#6366f1",
                "strokeWidth": min(1 + info["count"], 5),
            },
            "labelStyle": {
                "fontSize": "9px",
                "fontWeight": "bold",
                "fill": "#ef4444" if is_hot else "#a5b4fc",
            },
        })

    # ── Detect clusters (simple connected-component via BFS) ──
    adjacency = defaultdict(set)
    for (src, dst) in edge_map:
        if src in active_accounts and dst in active_accounts:
            adjacency[src].add(dst)
            adjacency[dst].add(src)

    visited = set()
    clusters = []

    for node_id in active_accounts:
        if node_id in visited:
            continue
        cluster = []
        queue = [node_id]
        while queue:
            current = queue.pop(0)
            if current in visited:
                continue
            visited.add(current)
            cluster.append(current)
            for neighbor in adjacency[current]:
                if neighbor not in visited:
                    queue.append(neighbor)
        if len(cluster) >= 2:
            cluster_risk = max(account_risk[c]["max_risk"] for c in cluster)
            cluster_volume = sum(account_risk[c]["total_out"] for c in cluster)
            clusters.append({
                "accounts": cluster,
                "size": len(cluster),
                "max_risk": round(cluster_risk, 4),
                "total_volume": round(cluster_volume, 2),
                "threat_level": "CRITICAL" if cluster_risk >= 0.7 else ("ELEVATED" if cluster_risk >= 0.4 else "NORMAL"),
            })

    # ── Stats ──
    total_volume = sum(info["total_amount"] for info in edge_map.values())
    flagged_flows = sum(1 for info in edge_map.values() if info["flagged"] > 0)
    high_risk_nodes = sum(1 for aid in active_accounts if account_risk[aid]["max_risk"] >= 0.7)

    return {
        "nodes": nodes,
        "edges": edges,
        "clusters": sorted(clusters, key=lambda c: c["max_risk"], reverse=True),
        "stats": {
            "total_accounts": len(active_accounts),
            "total_flows": len(edges),
            "flagged_flows": flagged_flows,
            "total_volume": round(total_volume, 2),
            "high_risk_nodes": high_risk_nodes,
        },
    }
