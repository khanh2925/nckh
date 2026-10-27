package vn.edu.indoormap.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import vn.edu.indoormap.dto.BuildingDto;
import vn.edu.indoormap.dto.FloorDto;
import vn.edu.indoormap.dto.ZoneDto;
import vn.edu.indoormap.service.FloorPlanService;

import java.util.List;

// Toà nhà, tầng, mặt bằng và vùng của một địa điểm: /api/venues/{venueId}/...
@RestController
@RequestMapping("/api/venues/{venueId:\\d+}")
public class FloorPlanController {
    private final FloorPlanService service;

    public FloorPlanController(FloorPlanService service) {
        this.service = service;
    }

    // ----- Toà nhà -----
    @GetMapping("/buildings")
    public List<BuildingDto> listBuildings(@PathVariable Long venueId) {
        return service.listBuildings(venueId);
    }

    @PostMapping("/buildings")
    @ResponseStatus(HttpStatus.CREATED)
    public BuildingDto createBuilding(@PathVariable Long venueId, @Valid @RequestBody BuildingDto dto) {
        return service.createBuilding(venueId, dto);
    }

    @PutMapping("/buildings/{id}")
    public BuildingDto updateBuilding(@PathVariable Long venueId, @PathVariable Long id, @Valid @RequestBody BuildingDto dto) {
        return service.updateBuilding(venueId, id, dto);
    }

    @DeleteMapping("/buildings/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteBuilding(@PathVariable Long venueId, @PathVariable Long id) {
        service.deleteBuilding(venueId, id);
    }

    // ----- Tầng -----
    @GetMapping("/floors")
    public List<FloorDto> listFloors(@PathVariable Long venueId) {
        return service.listFloors(venueId);
    }

    @PostMapping("/floors")
    @ResponseStatus(HttpStatus.CREATED)
    public FloorDto createFloor(@PathVariable Long venueId, @Valid @RequestBody FloorDto dto) {
        return service.createFloor(venueId, dto);
    }

    @PutMapping("/floors/{id}")
    public FloorDto updateFloor(@PathVariable Long venueId, @PathVariable Long id, @Valid @RequestBody FloorDto dto) {
        return service.updateFloor(venueId, id, dto);
    }

    // PUT /api/venues/1/floors/2/plan { svg | imageUrl, width, height, anchor, end, depthScale }; body null = gỡ mặt bằng
    @PutMapping("/floors/{id}/plan")
    public FloorDto updatePlan(@PathVariable Long venueId, @PathVariable Long id, @RequestBody(required = false) FloorDto.PlanDto plan) {
        return service.updatePlan(venueId, id, plan);
    }

    @DeleteMapping("/floors/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteFloor(@PathVariable Long venueId, @PathVariable Long id) {
        service.deleteFloor(venueId, id);
    }

    // ----- Vùng -----
    @GetMapping("/zones")
    public List<ZoneDto> listZones(@PathVariable Long venueId) {
        return service.listZones(venueId);
    }

    @PostMapping("/zones")
    @ResponseStatus(HttpStatus.CREATED)
    public ZoneDto createZone(@PathVariable Long venueId, @Valid @RequestBody ZoneDto dto) {
        return service.createZone(venueId, dto);
    }

    @PutMapping("/zones/{id}")
    public ZoneDto updateZone(@PathVariable Long venueId, @PathVariable Long id, @Valid @RequestBody ZoneDto dto) {
        return service.updateZone(venueId, id, dto);
    }

    @DeleteMapping("/zones/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteZone(@PathVariable Long venueId, @PathVariable Long id) {
        service.deleteZone(venueId, id);
    }
}
