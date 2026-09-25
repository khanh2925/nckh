package vn.edu.airportmap.service;

import vn.edu.airportmap.model.Location;

import java.util.List;

public interface LocationService {
    List<Location> getLocations(Integer floor);
    Location getLocationById(Long id);
    Location addLocation(Location location);
    Location updateLocation(Long id, Location location);
    boolean deleteLocation(Long id);
}
