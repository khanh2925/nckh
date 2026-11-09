package vn.edu.indoormap.service;

import vn.edu.indoormap.dto.JourneyDto;

import java.util.List;

// Quy trình của một địa điểm (UC027). Khách đọc quy trình đã công khai qua gói /map.
public interface JourneyService {
    List<JourneyDto> list(Long venueId);
    JourneyDto create(Long venueId, JourneyDto dto);
    JourneyDto update(Long venueId, Long id, JourneyDto dto);
    void delete(Long venueId, Long id);
    List<JourneyDto> published(Long venueId);
    // BR-36: điểm / loại đang là đích của bước trong quy trình công khai thì không cho xoá
    void checkLocationUnused(Long venueId, Long locationId);
    void checkTypeUnused(Long venueId, String typeCode);
}
