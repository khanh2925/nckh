package vn.edu.indoormap.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

// Một điểm của mạng lối đi
@JsonInclude(JsonInclude.Include.NON_NULL)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
public class WalkwayNodeDto {
    private String id;
    private Long floorId;
    // Chỉ đọc: mã toà nhà và số tầng để frontend vẽ theo tầng
    private String building;
    private Integer floor;
    private Double lat;
    private Double lng;
    // "Thang máy", "Thang cuốn", "Thang bộ"... khi đổi tầng tại điểm này
    private String connector;
}
