package vn.edu.indoormap.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.indoormap.dto.WalkwayEdgeDto;
import vn.edu.indoormap.dto.WalkwayNetworkDto;
import vn.edu.indoormap.dto.WalkwayNodeDto;
import vn.edu.indoormap.entity.Floor;
import vn.edu.indoormap.entity.WalkwayNode;
import vn.edu.indoormap.exception.ApiException;
import vn.edu.indoormap.mapper.WalkwayMapper;
import vn.edu.indoormap.repository.FloorRepository;
import vn.edu.indoormap.repository.WalkwayEdgeRepository;
import vn.edu.indoormap.repository.WalkwayNodeRepository;
import vn.edu.indoormap.security.VenueAccess;
import vn.edu.indoormap.service.WalkwayService;

import java.util.*;

@Service
@Transactional
public class WalkwayServiceImpl implements WalkwayService {
    private final WalkwayNodeRepository nodes;
    private final WalkwayEdgeRepository edges;
    private final FloorRepository floors;
    private final WalkwayMapper mapper;
    private final VenueAccess access;

    public WalkwayServiceImpl(WalkwayNodeRepository nodes, WalkwayEdgeRepository edges, FloorRepository floors,
                              WalkwayMapper mapper, VenueAccess access) {
        this.nodes = nodes; this.edges = edges; this.floors = floors; this.mapper = mapper; this.access = access;
    }

    @Override
    @Transactional(readOnly = true)
    public WalkwayNetworkDto get(Long venueId) {
        access.readable(venueId);
        return load(venueId);
    }

    // Thay toàn bộ mạng lối đi của địa điểm trong MỘT giao dịch: lỗi ở đâu thì mạng cũ giữ nguyên
    @Override
    public WalkwayNetworkDto replace(Long venueId, WalkwayNetworkDto network) {
        access.editable(venueId);
        if (network.getNodes() == null || network.getEdges() == null) {
            throw ApiException.badRequest("Thiếu danh sách điểm (nodes) hoặc đoạn (edges)");
        }

        Map<Long, Floor> venueFloors = new HashMap<>();
        for (Floor f : floors.findByBuilding_Venue_IdOrderByBuilding_SortOrderAscLevelAsc(venueId)) {
            venueFloors.put(f.getId(), f);
        }

        Set<String> ids = new HashSet<>();
        List<WalkwayNode> entities = new ArrayList<>();
        for (WalkwayNodeDto n : network.getNodes()) {
            if (n.getId() == null || n.getId().isBlank() || !ids.add(n.getId())) {
                throw ApiException.badRequest("Mã điểm bị trống hoặc trùng: " + n.getId());
            }
            if (n.getFloorId() == null || n.getLat() == null || n.getLng() == null) {
                throw ApiException.badRequest("Điểm " + n.getId() + " thiếu tầng hoặc toạ độ");
            }
            Floor floor = venueFloors.get(n.getFloorId());
            if (floor == null) {
                throw ApiException.badRequest("Điểm " + n.getId() + " thuộc tầng " + n.getFloorId() + " không có trong địa điểm này");
            }
            entities.add(mapper.toEntity(n, floor));
        }

        // A-B và B-A là cùng một đoạn: giữ một bản
        Map<String, WalkwayEdgeDto> unique = new LinkedHashMap<>();
        for (WalkwayEdgeDto e : network.getEdges()) {
            if (e.getFrom() == null || e.getTo() == null || !ids.contains(e.getFrom()) || !ids.contains(e.getTo()) || e.getFrom().equals(e.getTo())) {
                throw ApiException.badRequest("Đoạn không hợp lệ: " + e.getFrom() + " - " + e.getTo());
            }
            String key = e.getFrom().compareTo(e.getTo()) < 0 ? e.getFrom() + "|" + e.getTo() : e.getTo() + "|" + e.getFrom();
            unique.putIfAbsent(key, e);
        }

        // Xoá điểm của địa điểm này (đoạn đi theo nhờ ON DELETE CASCADE) rồi ghi mạng mới
        nodes.deleteAllByVenueId(venueId);
        nodes.flush();
        nodes.saveAll(entities);
        edges.saveAll(unique.values().stream().map(mapper::toEntity).toList());
        nodes.flush();
        return load(venueId);
    }

    private WalkwayNetworkDto load(Long venueId) {
        return new WalkwayNetworkDto(
                nodes.findByFloor_Building_Venue_IdOrderByIdAsc(venueId).stream().map(mapper::toDto).toList(),
                edges.findByVenueId(venueId).stream().map(mapper::toDto).toList());
    }
}
