package vn.edu.indoormap.service;

import vn.edu.indoormap.dto.BuildingDto;
import vn.edu.indoormap.dto.FloorDto;
import vn.edu.indoormap.dto.ZoneDto;

import java.util.List;

// Toà nhà, tầng (mặt bằng + căn chỉnh) và vùng của một địa điểm
public interface FloorPlanService {
    List<BuildingDto> listBuildings(Long venueId);
    BuildingDto createBuilding(Long venueId, BuildingDto dto);
    BuildingDto updateBuilding(Long venueId, Long id, BuildingDto dto);
    void deleteBuilding(Long venueId, Long id);

    List<FloorDto> listFloors(Long venueId);
    FloorDto createFloor(Long venueId, FloorDto dto);
    FloorDto updateFloor(Long venueId, Long id, FloorDto dto);
    FloorDto updatePlan(Long venueId, Long id, FloorDto.PlanDto plan);
    void deleteFloor(Long venueId, Long id);

    List<ZoneDto> listZones(Long venueId);
    ZoneDto createZone(Long venueId, ZoneDto dto);
    ZoneDto updateZone(Long venueId, Long id, ZoneDto dto);
    void deleteZone(Long venueId, Long id);
}
