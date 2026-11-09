package vn.edu.indoormap.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.*;
import vn.edu.indoormap.entity.JourneyQuestion;
import vn.edu.indoormap.entity.JourneyStep;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@JsonInclude(JsonInclude.Include.NON_NULL)
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class JourneyDto {
    private Long id;

    @NotBlank
    @Size(max = 120)
    private String name;
    private String description;
    private String icon;
    // DRAFT | PUBLISHED
    private String status;
    private Integer sortOrder;

    @Builder.Default
    private List<JourneyQuestion> questions = new ArrayList<>();
    @Builder.Default
    private List<JourneyStep> steps = new ArrayList<>();
    private Instant updatedAt;
}
