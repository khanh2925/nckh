package vn.edu.indoormap.service;

import vn.edu.indoormap.dto.ImportResultDto;
import vn.edu.indoormap.dto.LocationDto;

import java.util.List;

public interface LocationService {
    List<LocationDto> list(Long venueId, Long floorId);
    LocationDto get(Long venueId, Long id);
    LocationDto create(Long venueId, LocationDto dto);
    LocationDto update(Long venueId, Long id, LocationDto dto);
    void delete(Long venueId, Long id);
    ImportResultDto importMany(Long venueId, List<LocationDto> items);
}
