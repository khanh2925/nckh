package vn.edu.airportmap.mapper;

import org.springframework.stereotype.Component;
import vn.edu.airportmap.dto.LocationDto;
import vn.edu.airportmap.entity.Facility;
import vn.edu.airportmap.entity.Location;

@Component
public class LocationMapper {

    // Flattens floor/terminal/type relations back into the plain fields the front-end expects
    public LocationDto toDto(Location entity) {
        return LocationDto.builder()
                .id(entity.getId())
                .name(entity.getName())
                .type(entity.getType() == null ? null : entity.getType().getCode())
                .terminal(entity.getFloor().getTerminal().getCode())
                .floor(entity.getFloor().getLevel())
                .x(entity.getX())
                .y(entity.getY())
                .lat(entity.getLat())
                .lng(entity.getLng())
                .sourceId(entity.getSourceId())
                .phone(entity.getPhone())
                .website(entity.getWebsite())
                .area(entity.getArea())
                .description(entity.getDescription())
                .openingHours(entity.getOpeningHours())
                .facilities(entity.isFacilitiesKnown()
                        ? entity.getFacilities().stream().map(Facility::getName).toList()
                        : null)
                .build();
    }

    // Copies plain columns only; floor, type and facilities are resolved by the service
    public void updateEntity(LocationDto dto, Location entity) {
        entity.setName(dto.getName());
        entity.setX(dto.getX());
        entity.setY(dto.getY());
        entity.setLat(dto.getLat());
        entity.setLng(dto.getLng());
        entity.setSourceId(dto.getSourceId());
        entity.setPhone(dto.getPhone());
        entity.setWebsite(dto.getWebsite());
        entity.setArea(dto.getArea());
        entity.setDescription(dto.getDescription());
        entity.setOpeningHours(dto.getOpeningHours());
    }
}
