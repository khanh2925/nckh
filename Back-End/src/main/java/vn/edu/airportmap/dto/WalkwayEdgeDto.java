package vn.edu.airportmap.dto;

import lombok.*;

// A straight walkable segment between two nodes, usable in both directions.
// When the two nodes are on different floors, the edge is an elevator/escalator/stairs.
@Setter
@Getter
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class WalkwayEdgeDto {
    private String from;
    private String to;
}
