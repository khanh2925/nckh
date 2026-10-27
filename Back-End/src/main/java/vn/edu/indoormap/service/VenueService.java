package vn.edu.indoormap.service;

import vn.edu.indoormap.dto.VenueDto;
import vn.edu.indoormap.dto.VenueMapDto;

import java.util.List;

public interface VenueService {
    List<VenueDto> listPublished();
    VenueDto getBySlug(String slug);
    VenueMapDto getMap(String slug);
    List<VenueDto> listMine();
    VenueDto create(VenueDto dto);
    VenueDto update(Long id, VenueDto dto);
    void delete(Long id);
    VenueDto publish(Long id, boolean published);
}
