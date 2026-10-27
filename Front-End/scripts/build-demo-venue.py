"""Tạo dữ liệu mẫu v2 cho Sân bay Tân Sơn Nhất từ dữ liệu v1 + bản vẽ InMapz đã crawl.

Đầu ra (đúng định dạng API v2, để frontend chạy được khi chưa có backend):
  public/data/venues.json                  = GET /api/venues
  public/data/venues/tan-son-nhat.json     = GET /api/venues/tan-son-nhat/map
  public/plans/tan-son-nhat/*.svg          = bản vẽ mặt bằng (copy từ crawled_data)
  ../Back-End/database/v2/04_plans_tan_son_nhat.sql = gắn bản vẽ + tham số chiếu vào bảng floors

Chạy một lần từ thư mục Front-End:  python3 scripts/build-demo-venue.py
Nguồn: public/data/locations.json, public/data/walkways.json (bản xuất v1), crawled_data/tan_son_nhat_full.
"""
import json
import math
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent          # Front-End
CRAWL = ROOT.parent / "crawled_data" / "tan_son_nhat_full"
SLUG = "tan-son-nhat"

BUILDINGS = [
    # code, tên, thư mục crawl, có tầng nào
    ("T1", "Nhà ga T1 · Quốc nội", "t1_domestic"),
    ("T2", "Nhà ga T2 · Quốc tế", "t2_international"),
    ("T3", "Nhà ga T3 · Quốc nội mới", "t3_domestic"),
    ("KV", "Khuôn viên sân bay", "overview_campus"),
]
OUTLINES = {
    "T1": [[10.8148241, 106.6618890], [10.8152286, 106.6619245], [10.8152117, 106.6620597], [10.8151771, 106.6625317],
           [10.8147735, 106.6624961], [10.8147697, 106.6625408], [10.8146907, 106.6625339], [10.8146839, 106.6626143],
           [10.8129481, 106.6624618], [10.8129551, 106.6623797], [10.8125658, 106.6623455], [10.8126189, 106.6617191],
           [10.8126849, 106.6617249], [10.8126984, 106.6615654], [10.8127813, 106.6615727], [10.8128227, 106.6615763],
           [10.8131822, 106.6616080], [10.8134428, 106.6616310], [10.8141349, 106.6616920], [10.8148176, 106.6617521],
           [10.8148356, 106.6617537]],
    "T3": [[10.8110775, 106.6513371], [10.8113566, 106.6512363], [10.8132204, 106.6562175], [10.8129324, 106.6563252],
           [10.8124005, 106.6551139], [10.8121366, 106.6552074], [10.8112056, 106.6527862], [10.8115576, 106.6526460],
           [10.8112121, 106.6517196]],
}

TYPES = [
    # code, tên, icon (Bootstrap Icons), màu, nhóm
    ("gate", "Cửa ra máy bay", "bi-door-open", "#4a4f55", "gate"),
    ("checkin", "Quầy làm thủ tục", "bi-suitcase", "#a83039", "procedure"),
    ("security", "Kiểm tra an ninh", "bi-shield-check", "#a83039", "procedure"),
    ("baggage", "Băng chuyền hành lý", "bi-luggage", "#a83039", "procedure"),
    ("ticket", "Quầy vé", "bi-ticket-perforated", "#a83039", "procedure"),
    ("restaurant", "Nhà hàng", "bi-fork-knife", "#d9822b", "food"),
    ("coffee", "Cà phê", "bi-cup-hot", "#d9822b", "food"),
    ("shop", "Cửa hàng", "bi-bag", "#7b5ea7", "service"),
    ("lounge", "Phòng chờ", "bi-lamp", "#7b5ea7", "service"),
    ("atm", "ATM", "bi-credit-card", "#7b5ea7", "service"),
    ("information", "Thông tin", "bi-info-lg", "#7b5ea7", "service"),
    ("medical", "Phòng y tế", "bi-hospital", "#7b5ea7", "service"),
    ("smoking", "Phòng hút thuốc", "bi-slash-circle", "#7b5ea7", "service"),
    ("restroom", "Nhà vệ sinh", "bi-badge-wc", "#1f8a8a", "restroom"),
    ("elevator", "Thang máy", "bi-arrow-down-up", "#3f6fb5", "transport"),
    ("escalator", "Thang cuốn", "bi-chevron-double-up", "#3f6fb5", "transport"),
    ("staircase", "Cầu thang bộ", "bi-stairs", "#3f6fb5", "transport"),
    ("other", "Địa điểm khác", "bi-geo-alt", "#5f6368", "service"),
]


def merc_x(lng):
    return math.radians(lng)


def merc_y(lat):
    return math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def plan_for(svg_path, bounds):
    """Bản vẽ InMapz thẳng trục bắc–nam: góc trên-trái = (ne.lat, sw.lng), góc trên-phải = (ne.lat, ne.lng).
    depthScale = tỉ lệ (mét/px theo trục y) / (mét/px theo trục x) trong hệ Web Mercator."""
    text = svg_path.read_text(encoding="utf-8")
    w, h = [float(v) for v in re.search(r'viewBox="0 0 ([\d.]+) ([\d.]+)"', text).groups()]
    sw, ne = bounds["sw"], bounds["ne"]
    ux = (merc_x(ne["lng"]) - merc_x(sw["lng"])) / w
    uy = (merc_y(ne["lat"]) - merc_y(sw["lat"])) / h
    return {
        "width": w, "height": h,
        "anchor": {"image": [0, 0], "latlng": [ne["lat"], sw["lng"]]},
        "end": {"image": [w, 0], "latlng": [ne["lat"], ne["lng"]]},
        "depthScale": round(uy / ux, 6),
    }


def main():
    locations_v1 = json.loads((ROOT / "public/data/locations.json").read_text(encoding="utf-8"))
    walkways_v1 = json.loads((ROOT / "public/data/walkways.json").read_text(encoding="utf-8"))
    plan_dir = ROOT / "public/plans" / SLUG
    plan_dir.mkdir(parents=True, exist_ok=True)

    buildings, floors, sql = [], [], []
    floor_id = {}  # (building code, level) -> id
    next_floor = 1
    for order, (code, name, folder) in enumerate(BUILDINGS, start=1):
        meta = json.loads((CRAWL / folder / f"{folder}_floors.json").read_text(encoding="utf-8"))
        any_bounds = next(iter(meta.values()))["bounds"]
        center = [(any_bounds["sw"]["lat"] + any_bounds["ne"]["lat"]) / 2, (any_bounds["sw"]["lng"] + any_bounds["ne"]["lng"]) / 2]
        buildings.append({"id": order, "venueId": 1, "code": code, "name": name, "centerLat": round(center[0], 7),
                          "centerLng": round(center[1], 7), **({"outline": OUTLINES[code]} if code in OUTLINES else {}),
                          "sortOrder": order})
        for item in sorted(meta.values(), key=lambda m: int(m["level"])):
            level = int(item["level"])
            svg = next((CRAWL / folder / "svg_maps").glob(f"*Level{level}_*.svg"))
            target = f"{code}_L{level}.svg"
            shutil.copyfile(svg, plan_dir / target)
            plan = plan_for(svg, item["bounds"])
            plan["imageUrl"] = f"/plans/{SLUG}/{target}"
            label = (item.get("multilingual_name") or {}).get("vi") or item["name"]
            label = re.sub(r"\s*[–-]\s*", " · ", label.strip(), count=1)
            floors.append({"id": next_floor, "buildingId": order, "buildingCode": code, "level": level, "name": label, "plan": plan})
            floor_id[(code, level)] = next_floor
            a, e = plan["anchor"], plan["end"]
            # Bản v1 lưu khuôn viên với mã SGN_CAMPUS
            db_codes = "'KV', 'SGN_CAMPUS'" if code == "KV" else f"'{code}'"
            sql.append(
                f"UPDATE floors f SET plan_image_url = '{plan['imageUrl']}', plan_svg = NULL, plan_width = {plan['width']}, plan_height = {plan['height']},\n"
                f"    anchor_x = 0, anchor_y = 0, anchor_lat = {a['latlng'][0]}, anchor_lng = {a['latlng'][1]},\n"
                f"    end_x = {plan['width']}, end_y = 0, end_lat = {e['latlng'][0]}, end_lng = {e['latlng'][1]}, depth_scale = {plan['depthScale']}\n"
                f"FROM buildings b JOIN venues v ON v.id = b.venue_id\n"
                f"WHERE f.building_id = b.id AND v.slug = '{SLUG}' AND b.code IN ({db_codes}) AND f.level = {level};")
            next_floor += 1

    types = [{"id": i + 1, "code": c, "name": n, "icon": ic, "color": col, "groupName": g, "sortOrder": i}
             for i, (c, n, ic, col, g) in enumerate(TYPES)]
    facility_names = sorted({f for loc in locations_v1 for f in (loc.get("facilities") or [])})
    facilities = [{"id": i + 1, "name": n} for i, n in enumerate(facility_names)]

    locations = []
    for loc in locations_v1:
        code = "KV" if loc["terminal"] == "SGN_CAMPUS" else loc["terminal"]
        fid = floor_id.get((code, loc["floor"]))
        if fid is None:
            continue
        item = {"id": loc["id"], "floorId": fid, "building": code, "floor": loc["floor"], "name": loc["name"],
                "type": loc["type"], "lat": loc["lat"], "lng": loc["lng"]}
        for key in ("phone", "website", "area", "description", "openingHours", "sourceId", "facilities"):
            if loc.get(key):
                item[key] = loc[key]
        locations.append(item)

    nodes = []
    for n in walkways_v1["nodes"]:
        fid = floor_id.get((n["terminal"], n["floor"]))
        if fid is None:
            continue
        node = {"id": n["id"], "floorId": fid, "building": n["terminal"], "floor": n["floor"], "lat": n["lat"], "lng": n["lng"]}
        if n.get("connector"):
            node["connector"] = n["connector"]
        nodes.append(node)
    node_ids = {n["id"] for n in nodes}
    edges = [e for e in walkways_v1["edges"] if e["from"] in node_ids and e["to"] in node_ids]

    venue = {"id": 1, "slug": SLUG, "name": "Sân bay Quốc tế Tân Sơn Nhất", "kind": "airport",
             "description": "Trường Sơn, P.2, Tân Bình, TP.HCM · mở cửa 24/7. Bản đồ 3 nhà ga và khuôn viên, chỉ đường trong nhà.",
             "centerLat": 10.8165, "centerLng": 106.6600, "status": "PUBLISHED", "ownerName": "Cảng HKQT Tân Sơn Nhất (demo)",
             "updatedAt": "2026-10-24T09:12:00Z", "buildingCount": len(buildings), "floorCount": len(floors),
             "locationCount": len(locations)}
    bundle = {"venue": venue, "buildings": buildings, "floors": floors, "zones": [], "types": types,
              "facilities": facilities, "locations": locations, "walkways": {"nodes": nodes, "edges": edges}}

    (ROOT / "public/data/venues").mkdir(parents=True, exist_ok=True)
    (ROOT / "public/data/venues.json").write_text(json.dumps([venue], ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    (ROOT / f"public/data/venues/{SLUG}.json").write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")

    sql_path = ROOT.parent / "Back-End/database/v2/04_plans_tan_son_nhat.sql"
    header = ("-- Gắn bản vẽ mặt bằng InMapz (đã crawl) cho các tầng của Sân bay Tân Sơn Nhất.\n"
              "-- Sinh tự động bởi Front-End/scripts/build-demo-venue.py — chạy sau 02_migrate_from_v1.sql.\n"
              "-- Tệp SVG nằm trong Front-End/public/plans/tan-son-nhat/ (frontend phục vụ tĩnh).\n"
              "-- Bản vẽ thẳng trục bắc–nam: góc trên-trái (0,0) và góc trên-phải (W,0) là hai điểm mốc.\n"
              "SET search_path TO public;\nBEGIN;\n\n")
    sql_path.parent.mkdir(parents=True, exist_ok=True)
    sql_path.write_text(header + "\n\n".join(sql) + "\n\nCOMMIT;\n", encoding="utf-8")
    print(f"{len(buildings)} toà nhà, {len(floors)} tầng, {len(locations)} địa điểm, {len(nodes)} nút, {len(edges)} cạnh")


if __name__ == "__main__":
    main()
