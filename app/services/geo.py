"""Geospatial utilities for Impossible Travel Detection.

Uses IP-to-city mapping and Haversine distance calculation to detect
transactions occurring from geographically impossible locations within
short timeframes (e.g., Mumbai → Delhi in 2 minutes).
"""

import math
import logging
from typing import Optional

logger = logging.getLogger("sentinelclear.geo")

# ── Indian State Coordinate Atlas ──────────────────────────────────────────
# lat, lon pairs for major regions (using their capital's coords roughly)
CITY_COORDS: dict[str, tuple[float, float]] = {
    "Maharashtra":  (19.0760, 72.8777), # Mumbai coords
    "Delhi":        (28.7041, 77.1025),
    "Karnataka":    (12.9716, 77.5946), # Bangalore
    "Telangana":    (17.3850, 78.4867), # Hyderabad
    "Tamil Nadu":   (13.0827, 80.2707), # Chennai
    "West Bengal":  (22.5726, 88.3639), # Kolkata
    "Pune":         (18.5204, 73.8567),
    "Gujarat":      (23.0225, 72.5714), # Ahmedabad
    "Rajasthan":    (26.9124, 75.7873), # Jaipur
    "Uttar Pradesh":(26.8467, 80.9462), # Lucknow
    "Chandigarh":   (30.7333, 76.7794),
    "Kerala":       (9.9312,  76.2673), # Kochi
    "Assam":        (26.1445, 91.7362), # Guwahati
    "Madhya Pradesh":(23.2599, 77.4126), # Bhopal
    "Andhra Pradesh":(17.6868, 83.2185), # Visakhapatnam
    "Bihar":        (25.6093, 85.1376), # Patna
    # International anomaly locations
    "Singapore":    (1.3521,  103.8198),
    "Dubai":        (25.2048, 55.2708),
    "London":       (51.5074, -0.1278),
    "New York":     (40.7128, -74.0060),
    "Hong Kong":    (22.3193, 114.1694),
}

# ── IP Subnet → State Simulation Map ──────────────────────────────────────
# In production, this would be a MaxMind GeoIP2 lookup.
# For demo, we map IP prefixes to states to simulate geolocation.
IP_CITY_MAP: dict[str, str] = {
    "10.0.":    "Maharashtra",
    "10.1.":    "Delhi",
    "10.2.":    "Karnataka",
    "10.3.":    "Tamil Nadu",
    "10.4.":    "West Bengal",
    "10.5.":    "Telangana",
    "10.6.":    "Pune",
    "10.7.":    "Gujarat",
    "10.8.":    "Rajasthan",
    "10.9.":    "Uttar Pradesh",
    "172.16.":  "Singapore",
    "172.17.":  "Dubai",
    "172.18.":  "Maharashtra",     # Docker bridge default — treat as local
    "172.19.":  "New York",
    "172.20.":  "London",
    "192.168.": "Maharashtra",  # Default LAN → Maharashtra 
    "127.0.":   "Maharashtra",  # Localhost → Maharashtra
}

# Maximum plausible human travel speed in km/h
# Commercial aviation cruise speed ~900 km/h; we use 1000 for buffer
MAX_TRAVEL_SPEED_KMH = 1000.0


def haversine_km(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great-circle distance between two points on Earth (km)."""
    R = 6371.0  # Earth radius in km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1))
        * math.cos(math.radians(lat2))
        * math.sin(dlon / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def ip_to_city(ip: str) -> Optional[str]:
    """Resolve an IP address to a city name using prefix matching."""
    if not ip:
        return None
    for prefix, city in IP_CITY_MAP.items():
        if ip.startswith(prefix):
            return city
    # Unknown IP — cannot determine location
    return None


def get_city_coords(city: str) -> Optional[tuple[float, float]]:
    """Get lat/lon coordinates for a known city."""
    return CITY_COORDS.get(city)


def check_impossible_travel(
    current_city: str,
    previous_city: str,
    time_delta_seconds: float,
) -> dict:
    """Check if travel between two cities is physically impossible.
    
    Returns:
        {
            "is_impossible": bool,
            "distance_km": float,
            "required_speed_kmh": float,
            "max_allowed_kmh": float,
            "current_city": str,
            "previous_city": str,
            "time_gap_minutes": float,
        }
    """
    coords_current = get_city_coords(current_city)
    coords_previous = get_city_coords(previous_city)

    if not coords_current or not coords_previous:
        return {
            "is_impossible": False,
            "reason": "unknown_location",
            "distance_km": 0.0,
            "required_speed_kmh": 0.0,
            "max_allowed_kmh": MAX_TRAVEL_SPEED_KMH,
            "current_city": current_city,
            "previous_city": previous_city,
            "time_gap_minutes": 0.0,
        }

    if current_city == previous_city:
        return {
            "is_impossible": False,
            "reason": "same_city",
            "distance_km": 0.0,
            "required_speed_kmh": 0.0,
            "max_allowed_kmh": MAX_TRAVEL_SPEED_KMH,
            "current_city": current_city,
            "previous_city": previous_city,
            "time_gap_minutes": round(time_delta_seconds / 60.0, 1),
        }

    distance_km = haversine_km(
        coords_previous[0], coords_previous[1],
        coords_current[0], coords_current[1],
    )

    time_hours = max(time_delta_seconds / 3600.0, 0.001)  # Avoid division by zero
    required_speed = distance_km / time_hours
    time_gap_minutes = round(time_delta_seconds / 60.0, 1)

    is_impossible = required_speed > MAX_TRAVEL_SPEED_KMH

    if is_impossible:
        logger.warning(
            "IMPOSSIBLE TRAVEL DETECTED: %s → %s (%.0f km in %.1f min = %.0f km/h)",
            previous_city, current_city, distance_km, time_gap_minutes, required_speed,
        )

    return {
        "is_impossible": is_impossible,
        "distance_km": round(distance_km, 1),
        "required_speed_kmh": round(required_speed, 0),
        "max_allowed_kmh": MAX_TRAVEL_SPEED_KMH,
        "current_city": current_city,
        "previous_city": previous_city,
        "time_gap_minutes": time_gap_minutes,
    }
