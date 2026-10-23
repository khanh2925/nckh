package vn.edu.airportmap.model;

import lombok.*;

import java.util.List;

// The whole walkway network of the airport: GET and PUT /api/walkways send this object
@Setter
@Getter
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class WalkwayNetwork {
    private List<WalkwayNode> nodes;
    private List<WalkwayEdge> edges;
}
