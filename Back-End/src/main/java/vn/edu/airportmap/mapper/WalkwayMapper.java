package vn.edu.airportmap.mapper;

import org.springframework.stereotype.Component;
import vn.edu.airportmap.dto.WalkwayEdgeDto;
import vn.edu.airportmap.dto.WalkwayNodeDto;
import vn.edu.airportmap.entity.Floor;
import vn.edu.airportmap.entity.WalkwayEdge;
import vn.edu.airportmap.entity.WalkwayNode;

@Component
public class WalkwayMapper {

    // Flattens the floor relation back into terminal + floor number for the front-end
    public WalkwayNodeDto toDto(WalkwayNode entity) {
        return WalkwayNodeDto.builder()
                .id(entity.getId())
                .terminal(entity.getFloor().getTerminal().getCode())
                .floor(entity.getFloor().getLevel())
                .lat(entity.getLat())
                .lng(entity.getLng())
                .connector(entity.getConnector())
                .build();
    }

    public WalkwayEdgeDto toDto(WalkwayEdge entity) {
        return new WalkwayEdgeDto(entity.getId().getFromId(), entity.getId().getToId());
    }

    public WalkwayNode toEntity(WalkwayNodeDto dto, Floor floor) {
        return WalkwayNode.builder()
                .id(dto.getId())
                .floor(floor)
                .lat(dto.getLat())
                .lng(dto.getLng())
                .connector(dto.getConnector())
                .build();
    }

    public WalkwayEdge toEntity(WalkwayEdgeDto dto) {
        return new WalkwayEdge(dto.getFrom(), dto.getTo());
    }
}
