package vn.edu.airportmap.service;

import vn.edu.airportmap.dto.LocationDto;

import java.util.List;

public interface LocationService {
    List<LocationDto> getLocations(Integer floor);
    LocationDto getLocationById(Long id);
    LocationDto addLocation(LocationDto location);
    LocationDto updateLocation(Long id, LocationDto location);
    boolean deleteLocation(Long id);
}
