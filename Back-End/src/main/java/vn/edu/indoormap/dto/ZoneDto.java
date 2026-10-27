package vn.edu.indoormap.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.*;

import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ZoneDto {
    private Long id;

    @NotNull
    private Long floorId;

    @NotBlank
    private String name;
    private String color;

    // [[x, y], ...] pixel, tối thiểu 3 điểm
    @NotNull
    private List<List<Double>> polygon;
    private Integer sortOrder;
}
