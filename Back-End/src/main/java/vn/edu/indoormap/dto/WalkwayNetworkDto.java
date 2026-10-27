package vn.edu.indoormap.dto;

import lombok.*;

import java.util.List;

// Toàn bộ mạng lối đi của một địa điểm: GET và PUT /api/venues/{id}/walkways
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@ToString
public class WalkwayNetworkDto {
    private List<WalkwayNodeDto> nodes;
    private List<WalkwayEdgeDto> edges;
}
