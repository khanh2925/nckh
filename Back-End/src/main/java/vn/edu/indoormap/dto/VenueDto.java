package vn.edu.indoormap.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import lombok.*;

import java.time.Instant;
import java.util.List;

// Địa điểm: dùng cho cả danh sách công khai, Builder và quản trị hệ thống
@JsonInclude(JsonInclude.Include.NON_NULL)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VenueDto {
    private Long id;

    @NotBlank
    @Pattern(regexp = "^[a-z0-9]+(-[a-z0-9]+)*$", message = "chỉ gồm chữ thường, số và dấu gạch ngang")
    @Size(max = 60)
    private String slug;

    @NotBlank
    @Size(max = 200)
    private String name;

    // airport, hospital, school, mall, park, office, other
    private String kind;
    private String description;
    private Double centerLat;
    private Double centerLng;
    private List<List<Double>> outline;

    // DRAFT, PUBLISHED, HIDDEN (chỉ đọc; đổi bằng /publish, /unpublish hoặc quản trị hệ thống)
    private String status;
    private Long ownerId;
    private String ownerName;
    private Instant updatedAt;

    // Thống kê nhanh cho trang danh sách
    private Integer buildingCount;
    private Integer floorCount;
    private Long locationCount;
}
