package vn.edu.indoormap.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

// Tầng kèm mặt bằng và tham số căn chỉnh. plan có thể null khi tầng chưa có bản vẽ.
@JsonInclude(JsonInclude.Include.NON_NULL)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FloorDto {
    private Long id;

    @NotNull
    private Long buildingId;
    private String buildingCode;

    @NotNull
    private Integer level;

    @NotBlank
    private String name;

    private PlanDto plan;

    // Cùng cấu trúc với terminals.js cũ: imageSize, anchor, end, depthScale
    @JsonInclude(JsonInclude.Include.NON_NULL)
    @Getter
    @Setter
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class PlanDto {
        private String svg;
        private String imageUrl;
        private Double width;
        private Double height;
        private ControlPoint anchor;
        private ControlPoint end;
        private Double depthScale;
    }

    // image = [x, y] pixel trên bản vẽ; latlng = [lat, lng] thực tế
    public record ControlPoint(double[] image, double[] latlng) {}
}
