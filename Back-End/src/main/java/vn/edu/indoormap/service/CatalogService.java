package vn.edu.indoormap.service;

import vn.edu.indoormap.dto.FacilityDto;
import vn.edu.indoormap.dto.LocationTypeDto;

import java.util.List;

// Loại địa điểm và tiện ích của một địa điểm; danh mục mẫu của hệ thống
public interface CatalogService {
    List<LocationTypeDto> listTypes(Long venueId);
    LocationTypeDto createType(Long venueId, LocationTypeDto dto);
    LocationTypeDto updateType(Long venueId, Long id, LocationTypeDto dto);
    void deleteType(Long venueId, Long id);
    // Sao chép các loại mẫu phù hợp với loại hình của địa điểm (bỏ qua mã đã có)
    List<LocationTypeDto> copyTemplates(Long venueId);

    List<FacilityDto> listFacilities(Long venueId);
    FacilityDto createFacility(Long venueId, FacilityDto dto);
    FacilityDto updateFacility(Long venueId, Long id, FacilityDto dto);
    void deleteFacility(Long venueId, Long id);

    List<LocationTypeDto> listTemplates();
    LocationTypeDto createTemplate(LocationTypeDto dto);
    LocationTypeDto updateTemplate(Long id, LocationTypeDto dto);
    void deleteTemplate(Long id);
}
