"""Neo4j graph database service — async driver, ingestion, and Cypher queries.

Manages the lifecycle of the Neo4j async driver and provides functions for:
  - Schema constraint initialization
  - Transfer event ingestion (Account nodes + TRANSFERRED edges)
  - Network graph retrieval (replaces Python BFS)
  - Circular trading detection (native graph traversal)
  - Connected-component cluster detection
"""

import logging
from datetime import datetime, timedelta
from typing import Optional

from neo4j import AsyncGraphDatabase, AsyncDriver

from app.config import settings

logger = logging.getLogger("sentinelclear.neo4j")

# ── Module-level driver singleton ──────────────────────────────────
_driver: Optional[AsyncDriver] = None


async def connect() -> None:
    """Initialise the Neo4j async driver and verify connectivity."""
    global _driver
    _driver = AsyncGraphDatabase.driver(
        settings.NEO4J_URI,
        auth=(settings.NEO4J_USER, settings.NEO4J_PASS),
        max_connection_pool_size=25,
    )
    await _driver.verify_connectivity()
    logger.info("Neo4j driver connected to %s", settings.NEO4J_URI)
    await _init_constraints()


async def disconnect() -> None:
    """Gracefully close the Neo4j driver."""
    global _driver
    if _driver:
        await _driver.close()
        _driver = None
        logger.info("Neo4j driver closed")


def get_driver() -> AsyncDriver:
    """Return the active driver; raises if not connected."""
    if _driver is None:
        raise RuntimeError("Neo4j driver not initialised — call connect() first")
    return _driver


# ── Schema Constraints ────────────────────────────────────────────

async def _init_constraints() -> None:
    """Create uniqueness constraints on first boot (idempotent)."""
    queries = [
        "CREATE CONSTRAINT account_id_unique IF NOT EXISTS FOR (a:Account) REQUIRE a.account_id IS UNIQUE",
        "CREATE INDEX transfer_created IF NOT EXISTS FOR ()-[r:TRANSFERRED]-() ON (r.created_at)",
    ]
    async with get_driver().session() as session:
        for q in queries:
            await session.run(q)
    logger.info("Neo4j schema constraints initialised")


# ── Ingestion ─────────────────────────────────────────────────────

async def ingest_transfer(
    sender_account_id: str,
    receiver_account_id: str,
    transfer_id: str,
    amount: float,
    status: str,
    risk_score: float,
    rules_triggered: list[str] | None = None,
    created_at: str | None = None,
    sender_label: str | None = None,
    receiver_label: str | None = None,
) -> None:
    """MERGE sender/receiver Account nodes and create a TRANSFERRED edge.

    Uses MERGE so running the same transfer_id twice is idempotent.
    """
    cypher = """
    MERGE (s:Account {account_id: $sender_id})
    ON CREATE SET s.label = coalesce($sender_label, $sender_id),
                  s.first_seen = datetime()
    SET s.last_active = datetime()

    MERGE (r:Account {account_id: $receiver_id})
    ON CREATE SET r.label = coalesce($receiver_label, $receiver_id),
                  r.first_seen = datetime()
    SET r.last_active = datetime()

    MERGE (s)-[t:TRANSFERRED {transfer_id: $transfer_id}]->(r)
    ON CREATE SET t.amount       = $amount,
                  t.status       = $status,
                  t.risk_score   = $risk_score,
                  t.rules        = $rules,
                  t.created_at   = coalesce($created_at_str, toString(datetime()))
    """
    async with get_driver().session() as session:
        await session.run(
            cypher,
            sender_id=sender_account_id,
            receiver_id=receiver_account_id,
            transfer_id=transfer_id,
            amount=amount,
            status=status,
            risk_score=risk_score or 0.0,
            rules=rules_triggered or [],
            created_at_str=created_at,
            sender_label=sender_label,
            receiver_label=receiver_label,
        )


# ── Network Graph (React-Flow compatible) ─────────────────────────

async def get_network_graph(hours: int = 168, min_transfers: int = 1) -> dict:
    """Build nodes + edges for the AML network graph using native Cypher.

    Returns the same structure the React-Flow frontend expects.
    """
    cypher = """
    MATCH (s:Account)-[t:TRANSFERRED]->(r:Account)
    WHERE t.created_at IS NOT NULL AND datetime(t.created_at) >= datetime() - duration({hours: $hours})
    WITH s, r, t
    ORDER BY t.created_at ASC
    WITH s, r,
         collect(t) AS transfers,
         count(t) AS tx_count,
         sum(t.amount) AS total_amount,
         max(t.risk_score) AS max_risk,
         sum(CASE WHEN t.status = 'FLAGGED' THEN 1 ELSE 0 END) AS flagged_count
    WHERE tx_count >= $min_transfers
    RETURN s.account_id  AS sender_id,
           s.label       AS sender_label,
           r.account_id  AS receiver_id,
           r.label       AS receiver_label,
           tx_count,
           total_amount,
           max_risk,
           flagged_count
    """
    nodes_map: dict[str, dict] = {}
    edges: list[dict] = []
    idx = 0

    async with get_driver().session() as session:
        result = await session.run(cypher, hours=hours, min_transfers=min_transfers)
        records = await result.data()

    for rec in records:
        sender_id = rec["sender_id"]
        receiver_id = rec["receiver_id"]
        max_risk = rec["max_risk"] or 0.0
        flagged = rec["flagged_count"] or 0
        total_amount = rec["total_amount"] or 0.0
        tx_count = rec["tx_count"] or 0

        # Upsert sender node
        if sender_id not in nodes_map:
            nodes_map[sender_id] = {
                "label": rec["sender_label"] or sender_id[:8],
                "max_risk": 0.0,
                "total_out": 0.0,
                "total_in": 0.0,
                "tx_count": 0,
                "flagged": 0,
                "idx": idx,
            }
            idx += 1
        nodes_map[sender_id]["total_out"] += total_amount
        nodes_map[sender_id]["tx_count"] += tx_count
        nodes_map[sender_id]["max_risk"] = max(nodes_map[sender_id]["max_risk"], max_risk)
        nodes_map[sender_id]["flagged"] += flagged

        # Upsert receiver node
        if receiver_id not in nodes_map:
            nodes_map[receiver_id] = {
                "label": rec["receiver_label"] or receiver_id[:8],
                "max_risk": 0.0,
                "total_out": 0.0,
                "total_in": 0.0,
                "tx_count": 0,
                "flagged": 0,
                "idx": idx,
            }
            idx += 1
        nodes_map[receiver_id]["total_in"] += total_amount
        nodes_map[receiver_id]["tx_count"] += tx_count

        # Build edge
        is_hot = max_risk >= 0.7 or flagged > 0
        edges.append({
            "id": f"e-{sender_id[:8]}-{receiver_id[:8]}",
            "source": sender_id,
            "target": receiver_id,
            "animated": is_hot,
            "label": f"\u20b9{total_amount:,.0f} ({tx_count}x)",
            "style": {
                "stroke": "#ef4444" if is_hot else "#6366f1",
                "strokeWidth": min(1 + tx_count, 5),
            },
            "labelStyle": {
                "fontSize": "9px",
                "fontWeight": "bold",
                "fill": "#ef4444" if is_hot else "#a5b4fc",
            },
        })

    # Build React-Flow nodes with grid layout
    COLS = 4
    nodes = []
    for acct_id, info in nodes_map.items():
        col = info["idx"] % COLS
        row = info["idx"] // COLS
        risk_val = info["max_risk"]
        is_flagged = info["flagged"] > 0

        if risk_val >= 0.7:
            color = "#ef4444"
        elif risk_val >= 0.4:
            color = "#f59e0b"
        else:
            color = "#10b981"

        nodes.append({
            "id": acct_id,
            "type": "default",
            "position": {"x": 100 + col * 280, "y": 100 + row * 200},
            "data": {
                "label": info["label"],
                "risk_score": round(risk_val, 4),
                "total_out": round(info["total_out"], 2),
                "total_in": round(info["total_in"], 2),
                "tx_count": info["tx_count"],
                "flagged": info["flagged"],
                "is_flagged": is_flagged,
            },
            "style": {
                "background": color,
                "color": "#fff",
                "border": "2px solid #ef4444" if is_flagged else "1px solid rgba(255,255,255,0.2)",
                "borderRadius": "12px",
                "padding": "10px",
                "fontSize": "11px",
                "fontWeight": "bold",
                "boxShadow": "0 0 20px rgba(239,68,68,0.5)" if is_flagged else "none",
            },
        })

    # Stats
    total_volume = sum(n["total_out"] for n in nodes_map.values())
    high_risk_nodes = sum(1 for n in nodes_map.values() if n["max_risk"] >= 0.7)

    raw_clusters = await get_clusters(hours)
    
    enriched_clusters = []
    for c in raw_clusters:
        c_nodes = c["accounts"]
        max_risk = 0.0
        total_vol = 0.0
        for acct_id in c_nodes:
            if acct_id in nodes_map:
                max_risk = max(max_risk, nodes_map[acct_id]["max_risk"])
                total_vol += nodes_map[acct_id]["total_out"]
        c["max_risk"] = round(max_risk, 4)
        c["total_volume"] = round(total_vol, 2)
        c["threat_level"] = "CRITICAL" if max_risk >= 0.7 else (
            "ELEVATED" if max_risk >= 0.4 else "NORMAL"
        )
        enriched_clusters.append(c)
        
    enriched_clusters.sort(key=lambda x: x["max_risk"], reverse=True)

    return {
        "nodes": nodes,
        "edges": edges,
        "clusters": enriched_clusters,
        "stats": {
            "total_accounts": len(nodes),
            "total_flows": len(edges),
            "flagged_flows": sum(1 for e in edges if e.get("animated")),
            "total_volume": round(total_volume, 2),
            "high_risk_nodes": high_risk_nodes,
        },
    }


# ── Circular Trading Detection ────────────────────────────────────

async def detect_circular_trading(
    hours: int = 168,
    min_loop_length: int = 3,
    max_loop_length: int = 6,
) -> list[dict]:
    """Detect circular fund flows (A→B→C→…→A) using native Cypher path traversal.

    Returns a list of loops with participating accounts, total volume, and risk.
    """
    cypher = """
    MATCH path = (start:Account)-[:TRANSFERRED*%d..%d]->(start)
    WHERE ALL(r IN relationships(path)
              WHERE r.created_at IS NOT NULL AND datetime(r.created_at) >= datetime() - duration({hours: $hours}))
    WITH path,
         [n IN nodes(path) | n.account_id] AS account_ids,
         [n IN nodes(path) | n.label]       AS labels,
         reduce(s = 0.0, r IN relationships(path) | s + r.amount) AS loop_volume,
         reduce(m = 0.0, r IN relationships(path) | CASE WHEN r.risk_score > m THEN r.risk_score ELSE m END) AS max_risk,
         length(path) AS loop_length
    RETURN DISTINCT account_ids, labels, loop_volume, max_risk, loop_length
    ORDER BY max_risk DESC, loop_volume DESC
    LIMIT 50
    """ % (min_loop_length, max_loop_length)

    loops: list[dict] = []
    seen_signatures: set[str] = set()

    async with get_driver().session() as session:
        result = await session.run(cypher, hours=hours)
        records = await result.data()

    for rec in records:
        # Deduplicate rotations of the same loop
        ids = rec["account_ids"]
        sig = ",".join(sorted(set(ids)))
        if sig in seen_signatures:
            continue
        seen_signatures.add(sig)

        loops.append({
            "accounts": ids,
            "labels": rec["labels"],
            "loop_length": rec["loop_length"],
            "total_volume": round(rec["loop_volume"], 2),
            "max_risk": round(rec["max_risk"], 4),
            "threat_level": "CRITICAL" if rec["max_risk"] >= 0.7 else (
                "ELEVATED" if rec["max_risk"] >= 0.4 else "NORMAL"
            ),
        })

    return loops


# ── Cluster Detection ─────────────────────────────────────────────

async def get_clusters(hours: int = 168) -> list[dict]:
    """Detect connected components in the transfer graph using Cypher.

    Returns clusters sorted by risk (highest first).
    """
    # Use weakly-connected-component style traversal via Cypher
    cypher = """
    MATCH (a:Account)
    WHERE EXISTS {
      (a)-[:TRANSFERRED]->(:Account)
      WHERE ALL(r IN [(a)-[rel:TRANSFERRED]->() | rel]
                WHERE r.created_at IS NOT NULL AND datetime(r.created_at) >= datetime() - duration({hours: $hours}))
    } OR EXISTS {
      (:Account)-[:TRANSFERRED]->(a)
    }
    WITH collect(a) AS all_nodes
    UNWIND all_nodes AS node
    OPTIONAL MATCH (node)-[:TRANSFERRED*1..10]-(connected:Account)
    WITH node, collect(DISTINCT connected) + [node] AS component
    WITH component, size(component) AS comp_size
    WHERE comp_size >= 2
    WITH collect(component) AS raw_clusters
    UNWIND raw_clusters AS cluster
    WITH apoc.coll.sort(
           [n IN cluster | n.account_id]
         ) AS sorted_ids, cluster
    WITH DISTINCT sorted_ids AS unique_ids
    RETURN unique_ids AS accounts, size(unique_ids) AS cluster_size
    ORDER BY cluster_size DESC
    LIMIT 20
    """
    clusters: list[dict] = []

    try:
        async with get_driver().session() as session:
            result = await session.run(cypher, hours=hours)
            records = await result.data()

        for rec in records:
            accounts = sorted(list(set(rec["accounts"])))
            clusters.append({
                "accounts": accounts,
                "size": len(accounts),
                "max_risk": 0.0,  # Enriched above in get_network_graph
                "total_volume": 0.0,
                "threat_level": "NORMAL",
            })
    except Exception as exc:
        # Fallback: APOC may not be available; return simple connected pairs
        logger.warning("Cluster detection via APOC failed (%s) — using simple pair query", exc)
        cypher_simple = """
        MATCH (s:Account)-[t:TRANSFERRED]->(r:Account)
        WHERE t.created_at IS NOT NULL AND datetime(t.created_at) >= datetime() - duration({hours: $hours})
        WITH s.account_id AS sid, r.account_id AS rid,
             max(t.risk_score) AS max_risk,
             sum(t.amount) AS volume
        RETURN sid, rid, max_risk, volume
        ORDER BY max_risk DESC
        LIMIT 50
        """
        async with get_driver().session() as session:
            result = await session.run(cypher_simple, hours=hours)
            records = await result.data()

        # Group into simple clusters (pairs)
        seen = set()
        for rec in records:
            pair = tuple(sorted([rec["sid"], rec["rid"]]))
            if pair in seen:
                continue
            seen.add(pair)
            risk = rec["max_risk"] or 0.0
            clusters.append({
                "accounts": list(pair),
                "size": 2,
                "max_risk": round(risk, 4),
                "total_volume": round(rec["volume"], 2),
                "threat_level": "CRITICAL" if risk >= 0.7 else (
                    "ELEVATED" if risk >= 0.4 else "NORMAL"
                ),
            })

    return sorted(clusters, key=lambda c: c["max_risk"], reverse=True)


# ── Health Check ──────────────────────────────────────────────────

async def is_healthy() -> bool:
    """Return True if Neo4j is reachable."""
    try:
        async with get_driver().session() as session:
            result = await session.run("RETURN 1 AS ok")
            record = await result.single()
            return record is not None and record["ok"] == 1
    except Exception:
        return False


# ── Sync Postgres database to Neo4j ───────────────────────────────

async def sync_postgres_to_neo4j(db) -> None:
    """Sync all transfers from PostgreSQL to Neo4j if they are not already ingested."""
    from sqlalchemy import select
    from app.models import Transfer
    import json
    
    # 1. Fetch all transfers from SQL
    result = await db.execute(select(Transfer))
    transfers = result.scalars().all()
    
    logger.info("Syncing %d transfers from PostgreSQL to Neo4j...", len(transfers))
    
    # 2. Ingest each one
    for tx in transfers:
        # Parse fraud rules
        rules = []
        if tx.fraud_rules_triggered:
            try:
                rules = json.loads(tx.fraud_rules_triggered)
                if not isinstance(rules, list):
                    rules = [str(rules)]
            except Exception:
                rules = [tx.fraud_rules_triggered]
                
        # created_at formatting
        created_at_str = None
        if tx.created_at:
            created_at_str = tx.created_at.isoformat() + "Z"
            
        try:
            await ingest_transfer(
                sender_account_id=tx.sender_account_id,
                receiver_account_id=tx.receiver_account_id,
                transfer_id=tx.id,
                amount=float(tx.amount),
                status=tx.status,
                risk_score=tx.risk_score or 0.0,
                rules_triggered=rules,
                created_at=created_at_str,
            )
        except Exception as e:
            logger.error("Failed to sync transfer %s to Neo4j: %s", tx.id, e)
            
    logger.info("Successfully synced database transfers to Neo4j.")
