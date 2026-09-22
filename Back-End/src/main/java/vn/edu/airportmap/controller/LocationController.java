package vn.edu.airportmap.controller;

import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;
import vn.edu.airportmap.model.CreateLocationRequest;
import vn.edu.airportmap.model.Location;

import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;

@RestController
@RequestMapping("/api/locations")
@CrossOrigin(origins = {"http://localhost:5173", "http://127.0.0.1:5173"})
public class LocationController {
    private static final List<Location> LOCATIONS = new CopyOnWriteArrayList<>(List.of(
            new Location(1, "Cửa 01–02", "gate", "Cửa ra máy bay", 239, 168, 1),
            new Location(2, "Cửa 09", "gate", "Cửa ra máy bay", 775, 168, 1),
            new Location(3, "Cửa 15", "gate", "Cửa ra máy bay", 1203, 234, 1),
            new Location(4, "WC khu A", "restroom", "Nhà vệ sinh", 405, 476, 1),
            new Location(5, "Quầy thông tin", "information", "Thông tin sân bay", 317, 497, 1),
            new Location(6, "Phòng chờ", "lounge", "Phòng chờ hành khách", 824, 325, 1),
            new Location(7, "Thang máy tầng 2", "elevator", "Thang máy", 515, 355, 2),
            new Location(8, "WC tầng 2", "restroom", "Nhà vệ sinh", 885, 355, 2),
            new Location(9, "Phòng chờ tầng 2", "lounge", "Phòng chờ hành khách", 1040, 350, 2)
    ));
    private static final AtomicLong NEXT_ID = new AtomicLong(10);

    @GetMapping
    public List<Location> getLocations(@RequestParam(required = false) Integer floor) {
        if (floor == null) {
            return LOCATIONS;
        }
        return LOCATIONS.stream().filter(location -> location.floor() == floor).toList();
    }

    @PostMapping
    public Location createLocation(@RequestBody CreateLocationRequest request) {
        if (request.name() == null || request.name().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tên địa điểm không được để trống");
        }
        if (request.floor() < 1 || request.floor() > 2) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Tầng phải là 1 hoặc 2");
        }
        Location location = new Location(
                NEXT_ID.getAndIncrement(),
                request.name().trim(),
                request.type() == null ? "other" : request.type(),
                request.typeName() == null || request.typeName().isBlank() ? "Địa điểm" : request.typeName().trim(),
                request.x(), request.y(), request.floor()
        );
        LOCATIONS.add(location);
        return location;
    }
}
