package vn.edu.indoormap.mapper;

import org.springframework.stereotype.Component;
import vn.edu.indoormap.dto.WalkwayEdgeDto;
import vn.edu.indoormap.dto.WalkwayNodeDto;
import vn.edu.indoormap.entity.Floor;
import vn.edu.indoormap.entity.WalkwayEdge;
import vn.edu.indoormap.entity.WalkwayNode;

@Component
public class WalkwayMapper {

    public WalkwayNodeDto toDto(WalkwayNode n) {
        return WalkwayNodeDto.builder()
                .id(n.getId())
                .floorId(n.getFloor().getId())
                .building(n.getFloor().getBuilding().getCode())
                .floor(n.getFloor().getLevel())
                .lat(n.getLat()).lng(n.getLng())
                .connector(n.getConnector())
                .build();
    }

    public WalkwayEdgeDto toDto(WalkwayEdge e) {
        return new WalkwayEdgeDto(e.getId().getFromId(), e.getId().getToId());
    }

    public WalkwayNode toEntity(WalkwayNodeDto dto, Floor floor) {
        return WalkwayNode.builder()
                .id(dto.getId()).floor(floor).lat(dto.getLat()).lng(dto.getLng())
                .connector(dto.getConnector() == null || dto.getConnector().isBlank() ? null : dto.getConnector())
                .build();
    }

    public WalkwayEdge toEntity(WalkwayEdgeDto dto) {
        return new WalkwayEdge(dto.getFrom(), dto.getTo());
    }
}
