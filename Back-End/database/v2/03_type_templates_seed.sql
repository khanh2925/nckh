-- Danh mục loại địa điểm mẫu. Chạy sau 01_schema_v2.sql (hoặc sau 02_migrate_from_v1.sql).
-- icon = Bootstrap Icons, color = màu marker, group_name = nhóm lọc trên bản đồ.
SET search_path TO public;
BEGIN;
INSERT INTO type_templates (kind, code, name, icon, color, group_name, sort_order) VALUES
  -- dùng chung cho mọi loại hình
  ('all', 'information', 'Quầy thông tin',   'bi-info-lg',            '#7b5ea7', 'service',   10),
  ('all', 'restroom',    'Nhà vệ sinh',      'bi-badge-wc',           '#1f8a8a', 'restroom',  20),
  ('all', 'elevator',    'Thang máy',        'bi-arrow-down-up',      '#3f6fb5', 'transport', 30),
  ('all', 'escalator',   'Thang cuốn',       'bi-chevron-double-up',  '#3f6fb5', 'transport', 31),
  ('all', 'staircase',   'Cầu thang bộ',     'bi-stairs',             '#3f6fb5', 'transport', 32),
  ('all', 'entrance',    'Lối vào / ra',     'bi-box-arrow-in-right', '#3f6fb5', 'transport', 33),
  ('all', 'restaurant',  'Nhà hàng',         'bi-fork-knife',         '#d9822b', 'food',      40),
  ('all', 'coffee',      'Cà phê',           'bi-cup-hot',            '#d9822b', 'food',      41),
  ('all', 'shop',        'Cửa hàng',         'bi-bag',                '#7b5ea7', 'service',   50),
  ('all', 'atm',         'ATM',              'bi-credit-card',        '#7b5ea7', 'service',   51),
  ('all', 'medical',     'Phòng y tế',       'bi-hospital',           '#7b5ea7', 'service',   52),
  ('all', 'parking',     'Bãi đỗ xe',        'bi-p-square',           '#3f6fb5', 'transport', 53),
  ('all', 'other',       'Địa điểm khác',    'bi-geo-alt',            '#5f6368', 'service',   99),
  -- sân bay
  ('airport', 'gate',     'Cửa ra máy bay',     'bi-door-open',          '#4a4f55', 'gate',      1),
  ('airport', 'checkin',  'Quầy làm thủ tục',   'bi-suitcase',           '#a83039', 'procedure', 2),
  ('airport', 'baggage',  'Băng chuyền hành lý','bi-luggage',            '#a83039', 'procedure', 3),
  ('airport', 'ticket',   'Quầy vé',            'bi-ticket-perforated',  '#a83039', 'procedure', 4),
  ('airport', 'security', 'Kiểm tra an ninh',   'bi-shield-check',       '#a83039', 'procedure', 5),
  ('airport', 'lounge',   'Phòng chờ',          'bi-lamp',               '#7b5ea7', 'service',   6),
  ('airport', 'smoking',  'Phòng hút thuốc',    'bi-slash-circle',       '#7b5ea7', 'service',   7),
  -- bệnh viện
  ('hospital', 'reception',  'Quầy tiếp nhận',  'bi-person-badge',  '#a83039', 'procedure', 1),
  ('hospital', 'clinic',     'Phòng khám',      'bi-heart-pulse',   '#a83039', 'procedure', 2),
  ('hospital', 'department', 'Khoa',            'bi-building',      '#4a4f55', 'procedure', 3),
  ('hospital', 'pharmacy',   'Nhà thuốc',       'bi-capsule',       '#7b5ea7', 'service',   4),
  ('hospital', 'cashier',    'Quầy thu ngân',   'bi-cash-coin',     '#a83039', 'procedure', 5),
  ('hospital', 'emergency',  'Cấp cứu',         'bi-exclamation-triangle', '#a83039', 'procedure', 6),
  -- trường học
  ('school', 'classroom', 'Phòng học',        'bi-easel',         '#4a4f55', 'procedure', 1),
  ('school', 'lab',       'Phòng thí nghiệm', 'bi-eyedropper',    '#4a4f55', 'procedure', 2),
  ('school', 'office',    'Văn phòng khoa',   'bi-briefcase',     '#a83039', 'procedure', 3),
  ('school', 'library',   'Thư viện',         'bi-book',          '#7b5ea7', 'service',   4),
  ('school', 'hall',      'Hội trường',       'bi-people',        '#4a4f55', 'procedure', 5),
  -- công viên
  ('park', 'ride',       'Trò chơi',      'bi-star',          '#d9822b', 'service', 1),
  ('park', 'ticket',     'Quầy vé',       'bi-ticket-perforated', '#a83039', 'procedure', 2),
  ('park', 'rest_area',  'Khu nghỉ',      'bi-tree',          '#1f8a8a', 'service', 3),
  ('park', 'first_aid',  'Sơ cứu',        'bi-bandaid',       '#a83039', 'service', 4)
ON CONFLICT (kind, code) DO NOTHING;
COMMIT;
