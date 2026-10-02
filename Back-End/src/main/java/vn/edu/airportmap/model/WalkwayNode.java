package vn.edu.airportmap.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

// One point of the walkway network. Directions walk from node to node along the edges.
@JsonInclude(JsonInclude.Include.NON_NULL)
@Setter
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
public class WalkwayNode {
    // Text id made by the front-end (or by the seed file), e.g. "T1-0-15"
    private String id;
    private String terminal;
    private Integer floor;
    private Double lat;
    private Double lng;

    // "Thang máy", "Thang cuốn", "Thang bộ"... when passengers change floor at this node, otherwise null
    private String connector;
}
