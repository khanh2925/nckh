package vn.edu.indoormap.entity;

import lombok.*;

// Câu hỏi có/không hỏi khách trước khi đi ("Bạn đã check-in trực tuyến chưa?"), lưu JSONB trong journeys.questions
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class JourneyQuestion {
    private String id;
    private String text;
}
