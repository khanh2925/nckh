package vn.edu.airportmap.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.airportmap.dto.WalkwayEdgeDto;
import vn.edu.airportmap.dto.WalkwayNetworkDto;
import vn.edu.airportmap.dto.WalkwayNodeDto;
import vn.edu.airportmap.entity.Floor;
import vn.edu.airportmap.entity.WalkwayNode;
import vn.edu.airportmap.mapper.WalkwayMapper;
import vn.edu.airportmap.repository.FloorRepository;
import vn.edu.airportmap.repository.WalkwayEdgeRepository;
import vn.edu.airportmap.repository.WalkwayNodeRepository;
import vn.edu.airportmap.service.WalkwayService;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@Transactional
public class WalkwayServiceImpl implements WalkwayService {
    private final WalkwayNodeRepository walkwayNodeRepository;
    private final WalkwayEdgeRepository walkwayEdgeRepository;
    private final FloorRepository floorRepository;
    private final WalkwayMapper walkwayMapper;

    public WalkwayServiceImpl(WalkwayNodeRepository walkwayNodeRepository, WalkwayEdgeRepository walkwayEdgeRepository,
                              FloorRepository floorRepository, WalkwayMapper walkwayMapper) {
        this.walkwayNodeRepository = walkwayNodeRepository;
        this.walkwayEdgeRepository = walkwayEdgeRepository;
        this.floorRepository = floorRepository;
        this.walkwayMapper = walkwayMapper;
    }

    @Override
    @Transactional(readOnly = true)
    public WalkwayNetworkDto getWalkways() {
        List<WalkwayNodeDto> nodes = walkwayNodeRepository.findAllByOrderByIdAsc().stream()
                .map(walkwayMapper::toDto).toList();
        List<WalkwayEdgeDto> edges = walkwayEdgeRepository.findAllByOrderByIdFromIdAscIdToIdAsc().stream()
                .map(walkwayMapper::toDto).toList();
        return new WalkwayNetworkDto(nodes, edges);
    }

    // Runs in ONE transaction: if any row fails, the old network stays untouched
    @Override
    public WalkwayNetworkDto saveWalkways(WalkwayNetworkDto network) {
        // A-B and B-A are the same segment: keep only one copy
        Map<String, WalkwayEdgeDto> edges = new LinkedHashMap<>();
        for (WalkwayEdgeDto edge : network.getEdges()) {
            String key = edge.getFrom().compareTo(edge.getTo()) < 0
                    ? edge.getFrom() + "|" + edge.getTo()
                    : edge.getTo() + "|" + edge.getFrom();
            edges.putIfAbsent(key, edge);
        }

        // "T1|0" -> that floor entity
        Map<String, Floor> floors = new HashMap<>();
        for (Floor floor : floorRepository.findAll()) {
            floors.put(floor.getTerminal().getCode() + "|" + floor.getLevel(), floor);
        }

        List<WalkwayNode> nodes = new ArrayList<>();
        for (WalkwayNodeDto node : network.getNodes()) {
            Floor floor = floors.get(node.getTerminal() + "|" + node.getFloor());
            if (floor == null) {
                throw new IllegalArgumentException("Không có tầng " + node.getFloor() + " ở nhà ga " + node.getTerminal());
            }
            nodes.add(walkwayMapper.toEntity(node, floor));
        }

        // Bulk deletes run right away; edges first because they reference the nodes
        walkwayEdgeRepository.deleteAllInBatch();
        walkwayNodeRepository.deleteAllInBatch();
        walkwayNodeRepository.saveAll(nodes);
        walkwayEdgeRepository.saveAll(edges.values().stream().map(walkwayMapper::toEntity).toList());
        return getWalkways();
    }
}
