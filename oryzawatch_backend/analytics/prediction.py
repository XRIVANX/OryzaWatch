"""
Downwind spread prediction ("Heat Map Mode"). Given a hotspot's wind
direction and its current spread velocity, projects a cone-shaped danger
zone and tests every registered farm for whether it falls inside it -
driving both the map overlay and the per-farm warning/all-clear alerts.

Not a validated epidemiological model - a transparent, explainable
geometry (a fixed-angle wedge pointed downwind, reach scaled by how fast
the disease is currently estimated to spread) appropriate for a municipal
early-warning tool.
"""
import math

EARTH_RADIUS_KM = 6371.0

FORECAST_HORIZON_DAYS = 3       # how many days of spread the cone projects
HALF_ANGLE_DEG = 35             # cone half-width, centered on the wind direction
SEARCH_RADIUS_MULTIPLIER = 1.5  # farms within this multiple of the reach, but
                                 # outside the cone, get an all-clear instead of
                                 # being ignored entirely


def haversine_km(lat1, lng1, lat2, lng2):
    r1, r2 = math.radians(lat1), math.radians(lat2)
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat / 2) ** 2 + math.cos(r1) * math.cos(r2) * math.sin(dlng / 2) ** 2
    return 2 * EARTH_RADIUS_KM * math.asin(math.sqrt(a))


def bearing_deg(lat1, lng1, lat2, lng2):
    r1, r2 = math.radians(lat1), math.radians(lat2)
    dlng = math.radians(lng2 - lng1)
    y = math.sin(dlng) * math.cos(r2)
    x = math.cos(r1) * math.sin(r2) - math.sin(r1) * math.cos(r2) * math.cos(dlng)
    return (math.degrees(math.atan2(y, x)) + 360) % 360


def angle_diff(a, b):
    d = abs(a - b) % 360
    return min(d, 360 - d)


def destination_point(lat, lng, bearing, distance_km):
    """Point `distance_km` from (lat, lng) along `bearing` degrees."""
    lat1 = math.radians(lat)
    lng1 = math.radians(lng)
    brng = math.radians(bearing)
    d_r = distance_km / EARTH_RADIUS_KM
    lat2 = math.asin(
        math.sin(lat1) * math.cos(d_r) + math.cos(lat1) * math.sin(d_r) * math.cos(brng)
    )
    lng2 = lng1 + math.atan2(
        math.sin(brng) * math.sin(d_r) * math.cos(lat1),
        math.cos(d_r) - math.sin(lat1) * math.sin(lat2),
    )
    return math.degrees(lat2), math.degrees(lng2)


def build_cone_polygon(lat, lng, wind_direction_deg, reach_km, arc_points=10):
    """A pie-slice polygon: the hotspot, an arc of points `reach_km` away
    spanning the cone's width, and back - ready to hand straight to
    Leaflet's polygon() on either client."""
    polygon = [[lat, lng]]
    for i in range(arc_points + 1):
        frac = i / arc_points
        bearing = wind_direction_deg - HALF_ANGLE_DEG + frac * (2 * HALF_ANGLE_DEG)
        dp_lat, dp_lng = destination_point(lat, lng, bearing, reach_km)
        polygon.append([dp_lat, dp_lng])
    polygon.append([lat, lng])
    return polygon


def classify_farms(apex_lat, apex_lng, wind_direction_deg, reach_km, farms):
    """Split `farms` into (in_cone, outside_cone_but_in_range) based on
    bearing + distance from the hotspot."""
    search_radius_km = reach_km * SEARCH_RADIUS_MULTIPLIER
    in_cone, out_of_cone = [], []
    for farm in farms:
        lat, lng = float(farm.latitude), float(farm.longitude)
        distance = haversine_km(apex_lat, apex_lng, lat, lng)
        if distance > search_radius_km:
            continue
        bearing = bearing_deg(apex_lat, apex_lng, lat, lng)
        if distance <= reach_km and angle_diff(bearing, wind_direction_deg) <= HALF_ANGLE_DEG:
            in_cone.append(farm)
        else:
            out_of_cone.append(farm)
    return in_cone, out_of_cone
