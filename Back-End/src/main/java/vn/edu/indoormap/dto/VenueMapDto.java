package vn.edu.indoormap.dto;

import lombok.*;

import java.util.List;

// Gói dữ liệu Viewer cần để vẽ một địa điểm: GET /api/venues/{slug}/map
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VenueMapDto {
    private VenueDto venue;
    private List<BuildingDto> buildings;
    private List<FloorDto> floors;
    private List<ZoneDto> zones;
    private List<LocationTypeDto> types;
    private List<FacilityDto> facilities;
    private List<LocationDto> locations;
    private WalkwayNetworkDto walkways;
}
