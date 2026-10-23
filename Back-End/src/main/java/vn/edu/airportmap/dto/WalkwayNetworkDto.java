package vn.edu.airportmap.dto;

import lombok.*;

import java.util.List;

// The whole walkway network of the airport: GET and PUT /api/walkways send this object
@Setter
@Getter
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class WalkwayNetworkDto {
    private List<WalkwayNodeDto> nodes;
    private List<WalkwayEdgeDto> edges;
}
