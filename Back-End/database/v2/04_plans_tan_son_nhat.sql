-- Gắn bản vẽ mặt bằng InMapz (đã crawl) cho các tầng của Sân bay Tân Sơn Nhất.
-- Sinh tự động bởi Front-End/scripts/build-demo-venue.py — chạy sau 02_migrate_from_v1.sql.
-- Tệp SVG nằm trong Front-End/public/plans/tan-son-nhat/ (frontend phục vụ tĩnh).
-- Bản vẽ thẳng trục bắc–nam: góc trên-trái (0,0) và góc trên-phải (W,0) là hai điểm mốc.
SET search_path TO public;
BEGIN;

UPDATE floors f SET plan_image_url = '/plans/tan-son-nhat/T1_L0.svg', plan_svg = NULL, plan_width = 30000.0, plan_height = 46121.0,
    anchor_x = 0, anchor_y = 0, anchor_lat = 10.815483, anchor_lng = 106.661051,
    end_x = 30000.0, end_y = 0, end_lat = 10.815483, end_lng = 106.663239, depth_scale = 0.999085
FROM buildings b JOIN venues v ON v.id = b.venue_id
WHERE f.building_id = b.id AND v.slug = 'tan-son-nhat' AND b.code IN ('T1') AND f.level = 0;

UPDATE floors f SET plan_image_url = '/plans/tan-son-nhat/T1_L1.svg', plan_svg = NULL, plan_width = 30000.0, plan_height = 46121.0,
    anchor_x = 0, anchor_y = 0, anchor_lat = 10.815483, anchor_lng = 106.661051,
    end_x = 30000.0, end_y = 0, end_lat = 10.815483, end_lng = 106.663239, depth_scale = 0.999085
FROM buildings b JOIN venues v ON v.id = b.venue_id
WHERE f.building_id = b.id AND v.slug = 'tan-son-nhat' AND b.code IN ('T1') AND f.level = 1;

UPDATE floors f SET plan_image_url = '/plans/tan-son-nhat/T2_L0.svg', plan_svg = NULL, plan_width = 70000.0, plan_height = 34972.0,
    anchor_x = 0, anchor_y = 0, anchor_lat = 10.818439, anchor_lng = 106.659915,
    end_x = 70000.0, end_y = 0, end_lat = 10.818439, end_lng = 106.667123, depth_scale = 1.000245
FROM buildings b JOIN venues v ON v.id = b.venue_id
WHERE f.building_id = b.id AND v.slug = 'tan-son-nhat' AND b.code IN ('T2') AND f.level = 0;

UPDATE floors f SET plan_image_url = '/plans/tan-son-nhat/T2_L1.svg', plan_svg = NULL, plan_width = 70000.0, plan_height = 34972.0,
    anchor_x = 0, anchor_y = 0, anchor_lat = 10.818439, anchor_lng = 106.659915,
    end_x = 70000.0, end_y = 0, end_lat = 10.818439, end_lng = 106.667123, depth_scale = 1.000245
FROM buildings b JOIN venues v ON v.id = b.venue_id
WHERE f.building_id = b.id AND v.slug = 'tan-son-nhat' AND b.code IN ('T2') AND f.level = 1;

UPDATE floors f SET plan_image_url = '/plans/tan-son-nhat/T2_L2.svg', plan_svg = NULL, plan_width = 70000.0, plan_height = 34972.0,
    anchor_x = 0, anchor_y = 0, anchor_lat = 10.818439, anchor_lng = 106.659915,
    end_x = 70000.0, end_y = 0, end_lat = 10.818439, end_lng = 106.667123, depth_scale = 1.000245
FROM buildings b JOIN venues v ON v.id = b.venue_id
WHERE f.building_id = b.id AND v.slug = 'tan-son-nhat' AND b.code IN ('T2') AND f.level = 2;

UPDATE floors f SET plan_image_url = '/plans/tan-son-nhat/T2_L3.svg', plan_svg = NULL, plan_width = 70000.0, plan_height = 34972.0,
    anchor_x = 0, anchor_y = 0, anchor_lat = 10.818439, anchor_lng = 106.659915,
    end_x = 70000.0, end_y = 0, end_lat = 10.818439, end_lng = 106.667123, depth_scale = 1.000245
FROM buildings b JOIN venues v ON v.id = b.venue_id
WHERE f.building_id = b.id AND v.slug = 'tan-son-nhat' AND b.code IN ('T2') AND f.level = 3;

UPDATE floors f SET plan_image_url = '/plans/tan-son-nhat/T3_L1.svg', plan_svg = NULL, plan_width = 30000.0, plan_height = 22624.0,
    anchor_x = 0, anchor_y = 0, anchor_lat = 10.813904, anchor_lng = 106.650501,
    end_x = 30000.0, end_y = 0, end_lat = 10.813904, end_lng = 106.657205, depth_scale = 1.000207
FROM buildings b JOIN venues v ON v.id = b.venue_id
WHERE f.building_id = b.id AND v.slug = 'tan-son-nhat' AND b.code IN ('T3') AND f.level = 1;

UPDATE floors f SET plan_image_url = '/plans/tan-son-nhat/T3_L2.svg', plan_svg = NULL, plan_width = 30000.0, plan_height = 22624.0,
    anchor_x = 0, anchor_y = 0, anchor_lat = 10.813904, anchor_lng = 106.650501,
    end_x = 30000.0, end_y = 0, end_lat = 10.813904, end_lng = 106.657205, depth_scale = 1.000207
FROM buildings b JOIN venues v ON v.id = b.venue_id
WHERE f.building_id = b.id AND v.slug = 'tan-son-nhat' AND b.code IN ('T3') AND f.level = 2;

UPDATE floors f SET plan_image_url = '/plans/tan-son-nhat/T3_L3.svg', plan_svg = NULL, plan_width = 30000.0, plan_height = 22624.0,
    anchor_x = 0, anchor_y = 0, anchor_lat = 10.813904, anchor_lng = 106.650501,
    end_x = 30000.0, end_y = 0, end_lat = 10.813904, end_lng = 106.657205, depth_scale = 1.000207
FROM buildings b JOIN venues v ON v.id = b.venue_id
WHERE f.building_id = b.id AND v.slug = 'tan-son-nhat' AND b.code IN ('T3') AND f.level = 3;

UPDATE floors f SET plan_image_url = '/plans/tan-son-nhat/T3_L4.svg', plan_svg = NULL, plan_width = 30000.0, plan_height = 22624.0,
    anchor_x = 0, anchor_y = 0, anchor_lat = 10.813904, anchor_lng = 106.650501,
    end_x = 30000.0, end_y = 0, end_lat = 10.813904, end_lng = 106.657205, depth_scale = 1.000207
FROM buildings b JOIN venues v ON v.id = b.venue_id
WHERE f.building_id = b.id AND v.slug = 'tan-son-nhat' AND b.code IN ('T3') AND f.level = 4;

UPDATE floors f SET plan_image_url = '/plans/tan-son-nhat/KV_L1.svg', plan_svg = NULL, plan_width = 60000.0, plan_height = 38354.98,
    anchor_x = 0, anchor_y = 0, anchor_lat = 10.831274, anchor_lng = 106.633215,
    end_x = 60000.0, end_y = 0, end_lat = 10.831274, end_lng = 106.678459, depth_scale = 1.000236
FROM buildings b JOIN venues v ON v.id = b.venue_id
WHERE f.building_id = b.id AND v.slug = 'tan-son-nhat' AND b.code IN ('KV', 'SGN_CAMPUS') AND f.level = 1;

COMMIT;
