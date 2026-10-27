package vn.edu.indoormap.mapper;

import org.springframework.stereotype.Component;
import vn.edu.indoormap.dto.LocationDto;
import vn.edu.indoormap.entity.Facility;
import vn.edu.indoormap.entity.Location;

@Component
public class LocationMapper {

    public LocationDto toDto(Location e) {
        return LocationDto.builder()
                .id(e.getId())
                .floorId(e.getFloor().getId())
                .building(e.getFloor().getBuilding().getCode())
                .floor(e.getFloor().getLevel())
                .name(e.getName())
                .type(e.getType() == null ? "other" : e.getType().getCode())
                .x(e.getX()).y(e.getY()).lat(e.getLat()).lng(e.getLng())
                .phone(e.getPhone()).website(e.getWebsite()).area(e.getArea())
                .description(e.getDescription()).openingHours(e.getOpeningHours())
                .imageUrl(e.getImageUrl()).sourceId(e.getSourceId())
                .facilities(e.isFacilitiesKnown() ? e.getFacilities().stream().map(Facility::getName).toList() : null)
                .build();
    }

    // Các trường thường; floor, type và facilities do service gán
    public void apply(LocationDto dto, Location e) {
        e.setName(dto.getName().trim());
        e.setX(dto.getX()); e.setY(dto.getY());
        e.setLat(dto.getLat()); e.setLng(dto.getLng());
        e.setPhone(blankToNull(dto.getPhone()));
        e.setWebsite(blankToNull(dto.getWebsite()));
        e.setArea(blankToNull(dto.getArea()));
        e.setDescription(blankToNull(dto.getDescription()));
        e.setOpeningHours(blankToNull(dto.getOpeningHours()));
        e.setImageUrl(blankToNull(dto.getImageUrl()));
        e.setSourceId(dto.getSourceId());
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
