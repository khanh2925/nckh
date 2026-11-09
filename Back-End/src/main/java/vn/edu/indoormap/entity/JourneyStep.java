package vn.edu.indoormap.entity;

import lombok.*;

import java.util.ArrayList;
import java.util.List;

// Một bước của quy trình, lưu JSONB trong journeys.steps.
// Đích đến: một điểm cụ thể (targetLocationId) HOẶC một loại (targetType = mã loại, hệ thống chọn nơi phục vụ phù hợp).
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class JourneyStep {
    private String title;
    private String instruction;
    private Long targetLocationId;
    private String targetType;
    private boolean optional;
    // Bỏ bước khi mọi điều kiện đều thoả, vd. [{q1: true}] = "đã check-in trực tuyến"
    private List<SkipIf> skipIf = new ArrayList<>();
    // Thời gian ở bước (xếp hàng, làm thủ tục), ước tính của chủ địa điểm
    private Integer dwellMinutes;
    private boolean mustConfirm = true;

    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    public static class SkipIf {
        private String questionId;
        private boolean answer;
    }
}
