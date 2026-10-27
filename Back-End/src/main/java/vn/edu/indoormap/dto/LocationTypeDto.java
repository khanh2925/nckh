package vn.edu.indoormap.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import lombok.*;

// Loại địa điểm của venue; cũng dùng cho loại mẫu trong danh mục mặc định (có thêm kind)
@JsonInclude(JsonInclude.Include.NON_NULL)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LocationTypeDto {
    private Long id;

    @NotBlank
    @Pattern(regexp = "^[a-z0-9_]+$", message = "chỉ gồm chữ thường, số và dấu gạch dưới")
    private String code;

    @NotBlank
    private String name;
    private String icon;
    private String color;
    private String groupName;
    private Integer sortOrder;

    // Chỉ có ở danh mục mẫu: all, airport, hospital...
    private String kind;
}
