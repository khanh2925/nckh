package vn.edu.airportmap.controller;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import vn.edu.airportmap.model.Location;
import vn.edu.airportmap.service.LocationService;

import java.util.List;

@RestController
@RequestMapping("/api/locations")
@CrossOrigin(origins = {"http://localhost:5173", "http://127.0.0.1:5173"})
public class LocationController {
    private final LocationService locationService;

    // Spring injects LocationServiceImpl here automatically (constructor injection)
    public LocationController(LocationService locationService) {
        this.locationService = locationService;
    }

    // GET /api/locations  or  /api/locations?floor=1
    @GetMapping
    public List<Location> getLocations(@RequestParam(required = false) Integer floor) {
        return locationService.getLocations(floor);
    }

    // GET /api/locations/5
    @GetMapping("/{id}")
    public Location getLocationById(@PathVariable Long id) {
        Location location = locationService.getLocationById(id);
        if (location == null) {
            throw notFound(id);
        }
        return location;
    }

    // POST /api/locations
    @PostMapping
    public Location addLocation(@RequestBody Location location) {
        validate(location);
        return locationService.addLocation(location);
    }

    // PUT /api/locations/5
    @PutMapping("/{id}")
    public Location updateLocation(@PathVariable Long id, @RequestBody Location location) {
        validate(location);
        Location updated = locationService.updateLocation(id, location);
        if (updated == null) {
            throw notFound(id);
        }
        return updated;
    }

    // DELETE /api/locations/5  -> 204 No Content
    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteLocation(@PathVariable Long id) {
        if (!locationService.deleteLocation(id)) {
            throw notFound(id);
        }
    }

    // Checks required fields and fills default values
    private void validate(Location location) {
        if (location.getName() == null || location.getName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tên địa điểm không được để trống");
        }
        if (location.getFloor() == null || ((location.getX() == null || location.getY() == null) && (location.getLat() == null || location.getLng() == null))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thiếu tầng hoặc tọa độ");
        }

        location.setName(location.getName().trim());
        if (location.getType() == null || location.getType().isBlank()) {
            location.setType("other");
        }
        if (location.getTerminal() == null) {
            location.setTerminal("T1");
        }
    }

    private ResponseStatusException notFound(Long id) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, "Không tìm thấy địa điểm " + id);
    }
}
