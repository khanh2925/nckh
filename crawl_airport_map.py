"""
Script crawl toàn bộ dữ liệu sân bay Quốc tế Tân Sơn Nhất (InMapz - Vietjet Air)
Bao gồm:
- SGN_CAMPUS: Khuôn viên tổng quan sân bay
- T1: Ga Nội Địa T1 (2 tầng)
- T2: Ga Quốc Tế T2 (4 tầng)
- T3: Ga Nội Địa Mới T3 (4 tầng)
Xuất định dạng: CSV, JSON, GeoJSON (dùng cho Leaflet / Mapbox / QGIS / Excel) và bản vẽ mặt bằng vector SVG.
"""
import os
import sys
import json
import csv
import urllib.request

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
OUTPUT_DIR = os.path.join(BASE_DIR, 'crawled_data', 'tan_son_nhat_full')

AIRPORT_SLUG = 'sgn-tan-son-nhat-international-copy-airport-2010542573'
API_URL = f'https://vj.inmapz.com/webmap/data/?action=getVenue&venue={AIRPORT_SLUG}&company=VJA'

VENUE_MAPPING = {
    420321697272: {'folder': 't1_domestic', 'code': 'T1', 'title': 'Ga Nội Địa T1'},
    420321697575: {'folder': 't2_international', 'code': 'T2', 'title': 'Ga Quốc Tế T2'},
    420321772424: {'folder': 't3_domestic', 'code': 'T3', 'title': 'Ga Nội Địa T3'},
    420321697474: {'folder': 'overview_campus', 'code': 'SGN_CAMPUS', 'title': 'Khuôn Viên Sân Bay (Tổng quan)'}
}

def crawl_all():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    svg_master_dir = os.path.join(OUTPUT_DIR, 'all_svg_maps')
    os.makedirs(svg_master_dir, exist_ok=True)

    print(f"[1/5] Đang kết nối tải toàn bộ dữ liệu Tân Sơn Nhất từ InMapz API...")
    req = urllib.request.Request(API_URL, headers={'User-Agent': 'Mozilla/5.0'})
    raw_bytes = urllib.request.urlopen(req).read()
    raw_text = raw_bytes.decode('utf-8')
    data = json.loads(raw_text)

    # Lưu bản raw đầy đủ
    with open(os.path.join(OUTPUT_DIR, 'tan_son_nhat_raw_all.json'), 'w', encoding='utf-8') as f:
        f.write(raw_text)

    venues = data.get('venues', {})
    floors = data.get('floors', {})
    pois = data.get('pois', {})
    nodes = data.get('nodes', {})

    print(f"[2/5] Dữ liệu thu được: {len(venues)} khu nhà ga, {len(floors)} tầng, {len(pois)} POIs, {len(nodes)} navigation nodes.")

    # Tải các bản vẽ SVG
    print("[3/5] Đang tải các bản vẽ vector mặt bằng SVG...")
    for fid, f in floors.items():
        vid = f.get('venue_id')
        v_info = VENUE_MAPPING.get(vid, {'folder': f'venue_{vid}', 'code': 'OTHER', 'title': 'Khác'})
        v_folder = os.path.join(OUTPUT_DIR, v_info['folder'], 'svg_maps')
        os.makedirs(v_folder, exist_ok=True)

        svg_url = f.get('path_svg')
        if svg_url:
            clean_name = f.get('name', '').replace(' ', '_').replace('/', '_').replace('|', '_')
            filename = f"{v_info['code']}_Level{f.get('level')}_{clean_name}.svg"
            dest_term = os.path.join(v_folder, filename)
            dest_master = os.path.join(svg_master_dir, filename)
            try:
                s_req = urllib.request.Request(svg_url, headers={'User-Agent': 'Mozilla/5.0'})
                svg_content = urllib.request.urlopen(s_req).read()
                with open(dest_term, 'wb') as o1: o1.write(svg_content)
                with open(dest_master, 'wb') as o2: o2.write(svg_content)
                print(f"   -> [Tải xong] {filename}")
            except Exception as e:
                print(f"   ! Lỗi tải {filename}: {e}")

    # Xử lý POIs
    print("[4/5] Trích xuất và định dạng toàn bộ POIs...")
    all_pois = []
    for pid, p in pois.items():
        vid = p.get('venue_id')
        v_info = VENUE_MAPPING.get(vid, {'folder': 'other', 'code': 'OTHER', 'title': 'Khác'})
        fid = str(p.get('floor_id'))
        fl_info = floors.get(fid, {})
        m_name = p.get('multilingual_name') or {}
        name_vi = (m_name.get('vi') or p.get('name') or '').strip()
        name_en = (m_name.get('en') or p.get('name') or '').strip()

        row = {
            'poi_id': p.get('id'),
            'terminal_code': v_info['code'],
            'terminal_name': v_info['title'],
            'venue_id': vid,
            'floor_id': fid,
            'floor_name': fl_info.get('name', ''),
            'floor_level': fl_info.get('level', ''),
            'name_vi': name_vi,
            'name_en': name_en,
            'name_origin': p.get('name', ''),
            'lat': (p.get('center') or {}).get('lat', ''),
            'lng': (p.get('center') or {}).get('lng', ''),
            'type_id': p.get('type_id'),
            'type_name': p.get('type_name', ''),
            'categories': ','.join(str(c) for c in (p.get('categories') or [])),
            'phone': p.get('phone') or '',
            'website': p.get('website') or '',
            'open_close_at': p.get('open_close_at') or '',
            'status': p.get('status') or '',
            'img_logo': p.get('img_logo') or ''
        }
        all_pois.append(row)

    csv_fields = [
        'poi_id', 'terminal_code', 'terminal_name', 'venue_id', 'floor_id', 'floor_name', 
        'floor_level', 'name_vi', 'name_en', 'name_origin', 'lat', 'lng', 
        'type_id', 'type_name', 'categories', 'phone', 'website', 'open_close_at', 'status', 'img_logo'
    ]

    # Master CSV & JSON
    with open(os.path.join(OUTPUT_DIR, 'tan_son_nhat_all_pois.csv'), 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=csv_fields)
        writer.writeheader()
        writer.writerows(all_pois)

    with open(os.path.join(OUTPUT_DIR, 'tan_son_nhat_all_pois.json'), 'w', encoding='utf-8') as f:
        json.dump(all_pois, f, indent=2, ensure_ascii=False)

    # Master GeoJSON
    geojson_features = []
    for p in all_pois:
        if p['lat'] and p['lng']:
            geojson_features.append({
                'type': 'Feature',
                'geometry': {'type': 'Point', 'coordinates': [float(p['lng']), float(p['lat'])]},
                'properties': p
            })
    with open(os.path.join(OUTPUT_DIR, 'tan_son_nhat_pois.geojson'), 'w', encoding='utf-8') as f:
        json.dump({'type': 'FeatureCollection', 'name': 'TanSonNhat_Airport_POIs', 'features': geojson_features}, f, indent=2, ensure_ascii=False)

    # Tách dữ liệu theo từng nhà ga
    for vid, v_meta in VENUE_MAPPING.items():
        t_dir = os.path.join(OUTPUT_DIR, v_meta['folder'])
        os.makedirs(t_dir, exist_ok=True)
        t_pois = [p for p in all_pois if p['venue_id'] == vid]
        with open(os.path.join(t_dir, f"{v_meta['folder']}_pois.csv"), 'w', encoding='utf-8-sig', newline='') as f:
            w = csv.DictWriter(f, fieldnames=csv_fields)
            w.writeheader()
            w.writerows(t_pois)
        with open(os.path.join(t_dir, f"{v_meta['folder']}_pois.json"), 'w', encoding='utf-8') as f:
            json.dump(t_pois, f, indent=2, ensure_ascii=False)
        t_floors = {fid: fl for fid, fl in floors.items() if fl.get('venue_id') == vid}
        with open(os.path.join(t_dir, f"{v_meta['folder']}_floors.json"), 'w', encoding='utf-8') as f:
            json.dump(t_floors, f, indent=2, ensure_ascii=False)
        t_nodes = {nid: nd for nid, nd in nodes.items() if nd.get('venue_id') == vid}
        with open(os.path.join(t_dir, f"{v_meta['folder']}_nodes.json"), 'w', encoding='utf-8') as f:
            json.dump(t_nodes, f, indent=2, ensure_ascii=False)

    # Master Nodes
    print("[5/5] Trích xuất mạng lưới waypoint điều hướng (Nodes)...")
    all_nodes = []
    for nid, n in nodes.items():
        vid = n.get('venue_id')
        v_info = VENUE_MAPPING.get(vid, {'folder': 'other', 'code': 'OTHER', 'title': 'Khác'})
        fid = str(n.get('floor_id'))
        fl_info = floors.get(fid, {})
        all_nodes.append({
            'node_id': nid,
            'terminal_code': v_info['code'],
            'terminal_name': v_info['title'],
            'venue_id': vid,
            'floor_id': fid,
            'floor_name': fl_info.get('name', ''),
            'lat': (n.get('center') or {}).get('lat', ''),
            'lng': (n.get('center') or {}).get('lng', ''),
            'radius': n.get('radius', ''),
            'type': n.get('type', ''),
            'weight': n.get('weight', '')
        })

    with open(os.path.join(OUTPUT_DIR, 'tan_son_nhat_all_nodes.csv'), 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['node_id', 'terminal_code', 'terminal_name', 'venue_id', 'floor_id', 'floor_name', 'lat', 'lng', 'radius', 'type', 'weight'])
        w.writeheader()
        w.writerows(all_nodes)
    with open(os.path.join(OUTPUT_DIR, 'tan_son_nhat_all_nodes.json'), 'w', encoding='utf-8') as f:
        json.dump(all_nodes, f, indent=2, ensure_ascii=False)

    print("\n" + "="*60)
    print(f"✓ ĐÃ HOÀN TẤT QUÉT TOÀN BỘ SÂN BAY TÂN SƠN NHẤT!")
    print(f"  • Tổng POIs thu thập: {len(all_pois)} điểm")
    print(f"  • Tổng Nodes dẫn đường: {len(all_nodes)} điểm")
    print(f"  • Tổng bản vẽ SVG: {len(floors)} tầng")
    print(f"  • Thư mục lưu trữ: {OUTPUT_DIR}")
    print("="*60)

if __name__ == '__main__':
    crawl_all()
