package vn.edu.airportmap.model;

import lombok.*;

// A straight walkable segment between two nodes, usable in both directions.
// When the two nodes are on different floors, the edge is an elevator/escalator/stairs.
@Setter
@Getter
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class WalkwayEdge {
    private String from;
    private String to;
}
