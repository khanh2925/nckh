-- Quy trình mẫu cho Sân bay Tân Sơn Nhất (venue slug 'tan-son-nhat'). Chạy sau 05_journeys.sql.

-- Bước trỏ tới mã loại (checkin, security, gate, restroom, baggage) nên không phụ thuộc id điểm.

-- Chạy lại không tạo trùng (bỏ qua quy trình cùng tên đã có).

INSERT INTO journeys (venue_id, name, description, icon, status, sort_order, questions, steps)
SELECT v.id, 'Đi chuyến bay nội địa', 'Từ sảnh đi tới cửa ra máy bay: làm thủ tục, kiểm tra an ninh, ra cửa.', 'plane-takeoff', 'PUBLISHED', 1,
       '[{"id": "q1", "text": "Bạn đã check-in trực tuyến chưa?"}, {"id": "q2", "text": "Bạn có hành lý ký gửi không?"}]'::jsonb,
       '[{"title": "Làm thủ tục, ký gửi hành lý", "skipIf": [{"answer": true, "questionId": "q1"}, {"answer": false, "questionId": "q2"}], "optional": false, "targetType": "checkin", "instruction": "Xuất trình CCCD hoặc hộ chiếu cùng mã đặt chỗ; ký gửi hành lý và nhận thẻ lên máy bay.", "mustConfirm": true, "dwellMinutes": 15, "targetLocationId": null}, {"title": "Kiểm tra an ninh", "skipIf": [], "optional": false, "targetType": "security", "instruction": "Chuẩn bị CCCD và thẻ lên máy bay. Bỏ chất lỏng trên 100 ml; laptop, điện thoại để ra khay riêng.", "mustConfirm": true, "dwellMinutes": 10, "targetLocationId": null}, {"title": "Ra cửa máy bay", "skipIf": [], "optional": false, "targetType": "gate", "instruction": "Xem số cửa trên thẻ lên máy bay, có mặt trước giờ lên máy bay 30 phút. Bấm Đổi nơi ở màn tổng quan để chọn đúng cửa của bạn.", "mustConfirm": true, "dwellMinutes": null, "targetLocationId": null}]'::jsonb
FROM venues v
WHERE v.slug = 'tan-son-nhat'
  AND NOT EXISTS (SELECT 1 FROM journeys x WHERE x.venue_id = v.id AND x.name = 'Đi chuyến bay nội địa');

INSERT INTO journeys (venue_id, name, description, icon, status, sort_order, questions, steps)
SELECT v.id, 'Đến nơi, lấy hành lý', 'Từ cửa máy bay tới băng chuyền hành lý.', 'luggage', 'PUBLISHED', 2,
       '[]'::jsonb,
       '[{"title": "Ghé nhà vệ sinh", "skipIf": [], "optional": true, "targetType": "restroom", "instruction": "Bước tuỳ chọn, bấm Bỏ qua nếu không cần.", "mustConfirm": true, "dwellMinutes": 5, "targetLocationId": null}, {"title": "Lấy hành lý ở băng chuyền", "skipIf": [], "optional": false, "targetType": "baggage", "instruction": "Xem số băng chuyền theo số hiệu chuyến bay trên màn hình. Kiểm tra thẻ hành lý trước khi rời băng chuyền.", "mustConfirm": true, "dwellMinutes": 15, "targetLocationId": null}]'::jsonb
FROM venues v
WHERE v.slug = 'tan-son-nhat'
  AND NOT EXISTS (SELECT 1 FROM journeys x WHERE x.venue_id = v.id AND x.name = 'Đến nơi, lấy hành lý');
