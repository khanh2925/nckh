package vn.edu.indoormap.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;

// Điểm quan tâm. NON_NULL để bỏ các trường trống khỏi JSON
@JsonInclude(JsonInclude.Include.NON_NULL)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
public class LocationDto {
    private Long id;

    @NotNull
    private Long floorId;
    // Chỉ đọc, tiện cho frontend: mã toà nhà và số tầng
    private String building;
    private Integer floor;

    @NotBlank
    private String name;

    // Mã loại địa điểm của venue, ví dụ "gate"; null = "other"
    private String type;

    // Pixel trên bản vẽ của tầng, KHÔNG phải kinh/vĩ độ
    private Double x;
    private Double y;

    // WGS84
    private Double lat;
    private Double lng;

    private String phone;
    private String website;
    private String area;
    private String description;
    private String openingHours;
    private String imageUrl;
    private Long sourceId;

    // Tên tiện ích; null = chưa nhập
    private List<String> facilities;
}
