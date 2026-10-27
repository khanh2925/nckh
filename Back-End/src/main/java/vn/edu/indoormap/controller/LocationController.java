package vn.edu.indoormap.controller;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import vn.edu.indoormap.dto.ImportResultDto;
import vn.edu.indoormap.dto.LocationDto;
import vn.edu.indoormap.service.LocationService;

import java.util.List;

// Điểm quan tâm (POI) của một địa điểm
@RestController
@RequestMapping("/api/venues/{venueId:\\d+}/locations")
public class LocationController {
    private final LocationService locations;

    public LocationController(LocationService locations) {
        this.locations = locations;
    }

    // GET /api/venues/1/locations  hoặc  ?floorId=3
    @GetMapping
    public List<LocationDto> list(@PathVariable Long venueId, @RequestParam(required = false) Long floorId) {
        return locations.list(venueId, floorId);
    }

    @GetMapping("/{id}")
    public LocationDto get(@PathVariable Long venueId, @PathVariable Long id) {
        return locations.get(venueId, id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public LocationDto create(@PathVariable Long venueId, @RequestBody LocationDto dto) {
        return locations.create(venueId, dto);
    }

    @PutMapping("/{id}")
    public LocationDto update(@PathVariable Long venueId, @PathVariable Long id, @RequestBody LocationDto dto) {
        return locations.update(venueId, id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long venueId, @PathVariable Long id) {
        locations.delete(venueId, id);
    }

    // POST /api/venues/1/locations/import [ {...}, {...} ] -> { imported, skipped, errors }
    @PostMapping("/import")
    public ImportResultDto importMany(@PathVariable Long venueId, @RequestBody List<LocationDto> items) {
        return locations.importMany(venueId, items);
    }
}
