package vn.edu.indoormap.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.indoormap.dto.BuildingDto;
import vn.edu.indoormap.dto.FloorDto;
import vn.edu.indoormap.dto.ZoneDto;
import vn.edu.indoormap.entity.Building;
import vn.edu.indoormap.entity.Floor;
import vn.edu.indoormap.entity.Venue;
import vn.edu.indoormap.entity.Zone;
import vn.edu.indoormap.exception.ApiException;
import vn.edu.indoormap.mapper.VenueMapper;
import vn.edu.indoormap.repository.BuildingRepository;
import vn.edu.indoormap.repository.FloorRepository;
import vn.edu.indoormap.repository.ZoneRepository;
import vn.edu.indoormap.security.VenueAccess;
import vn.edu.indoormap.service.FloorPlanService;

import java.util.List;

@Service
@Transactional
public class FloorPlanServiceImpl implements FloorPlanService {
    private final BuildingRepository buildings;
    private final FloorRepository floors;
    private final ZoneRepository zones;
    private final VenueMapper mapper;
    private final VenueAccess access;

    public FloorPlanServiceImpl(BuildingRepository buildings, FloorRepository floors, ZoneRepository zones,
                                VenueMapper mapper, VenueAccess access) {
        this.buildings = buildings; this.floors = floors; this.zones = zones; this.mapper = mapper; this.access = access;
    }

    // ---------- Toà nhà ----------
    @Override
    @Transactional(readOnly = true)
    public List<BuildingDto> listBuildings(Long venueId) {
        access.readable(venueId);
        return buildings.findByVenue_IdOrderBySortOrderAscIdAsc(venueId).stream().map(mapper::toDto).toList();
    }

    @Override
    public BuildingDto createBuilding(Long venueId, BuildingDto dto) {
        Venue venue = access.editable(venueId);
        if (buildings.existsByVenue_IdAndCodeIgnoreCase(venueId, dto.getCode().trim())) {
            throw ApiException.conflict("Mã toà nhà '" + dto.getCode() + "' đã có");
        }
        Building b = Building.builder().venue(venue).build();
        mapper.apply(dto, b);
        return mapper.toDto(buildings.save(b));
    }

    @Override
    public BuildingDto updateBuilding(Long venueId, Long id, BuildingDto dto) {
        access.editable(venueId);
        Building b = buildings.findByIdAndVenue_Id(id, venueId).orElseThrow(() -> ApiException.notFound("toà nhà " + id));
        if (!b.getCode().equalsIgnoreCase(dto.getCode().trim()) && buildings.existsByVenue_IdAndCodeIgnoreCase(venueId, dto.getCode().trim())) {
            throw ApiException.conflict("Mã toà nhà '" + dto.getCode() + "' đã có");
        }
        mapper.apply(dto, b);
        return mapper.toDto(buildings.save(b));
    }

    @Override
    public void deleteBuilding(Long venueId, Long id) {
        access.editable(venueId);
        Building b = buildings.findByIdAndVenue_Id(id, venueId).orElseThrow(() -> ApiException.notFound("toà nhà " + id));
        buildings.delete(b);
    }

    // ---------- Tầng ----------
    @Override
    @Transactional(readOnly = true)
    public List<FloorDto> listFloors(Long venueId) {
        access.readable(venueId);
        return floors.findByBuilding_Venue_IdOrderByBuilding_SortOrderAscLevelAsc(venueId).stream().map(mapper::toDto).toList();
    }

    @Override
    public FloorDto createFloor(Long venueId, FloorDto dto) {
        access.editable(venueId);
        Building b = buildings.findByIdAndVenue_Id(dto.getBuildingId(), venueId)
                .orElseThrow(() -> ApiException.notFound("toà nhà " + dto.getBuildingId()));
        if (floors.existsByBuilding_IdAndLevel(b.getId(), dto.getLevel())) {
            throw ApiException.conflict("Toà nhà " + b.getCode() + " đã có tầng " + dto.getLevel());
        }
        Floor f = Floor.builder().building(b).level(dto.getLevel()).name(dto.getName().trim()).build();
        mapper.applyPlan(dto.getPlan(), f);
        return mapper.toDto(floors.save(f));
    }

    @Override
    public FloorDto updateFloor(Long venueId, Long id, FloorDto dto) {
        access.editable(venueId);
        Floor f = floors.findByIdAndBuilding_Venue_Id(id, venueId).orElseThrow(() -> ApiException.notFound("tầng " + id));
        if (dto.getBuildingId() != null && !dto.getBuildingId().equals(f.getBuilding().getId())) {
            Building b = buildings.findByIdAndVenue_Id(dto.getBuildingId(), venueId)
                    .orElseThrow(() -> ApiException.notFound("toà nhà " + dto.getBuildingId()));
            f.setBuilding(b);
        }
        if (!dto.getLevel().equals(f.getLevel()) && floors.existsByBuilding_IdAndLevel(f.getBuilding().getId(), dto.getLevel())) {
            throw ApiException.conflict("Toà nhà " + f.getBuilding().getCode() + " đã có tầng " + dto.getLevel());
        }
        f.setLevel(dto.getLevel());
        f.setName(dto.getName().trim());
        return mapper.toDto(floors.save(f));
    }

    // Tải mặt bằng và chấm điểm mốc: PUT /api/venues/{id}/floors/{fid}/plan
    @Override
    public FloorDto updatePlan(Long venueId, Long id, FloorDto.PlanDto plan) {
        access.editable(venueId);
        Floor f = floors.findByIdAndBuilding_Venue_Id(id, venueId).orElseThrow(() -> ApiException.notFound("tầng " + id));
        if (plan != null) {
            if ((plan.getAnchor() == null) != (plan.getEnd() == null)) {
                throw ApiException.badRequest("Cần đủ hai điểm mốc (anchor và end) để căn chỉnh mặt bằng");
            }
            if (plan.getAnchor() != null && (bad(plan.getAnchor().image()) || bad(plan.getAnchor().latlng())
                    || bad(plan.getEnd().image()) || bad(plan.getEnd().latlng()))) {
                throw ApiException.badRequest("Điểm mốc phải có dạng image [x, y] và latlng [lat, lng]");
            }
            if ((plan.getSvg() != null || plan.getImageUrl() != null) && (plan.getWidth() == null || plan.getHeight() == null)) {
                throw ApiException.badRequest("Thiếu kích thước (width, height) của bản vẽ");
            }
        }
        mapper.applyPlan(plan, f);
        return mapper.toDto(floors.save(f));
    }

    @Override
    public void deleteFloor(Long venueId, Long id) {
        access.editable(venueId);
        Floor f = floors.findByIdAndBuilding_Venue_Id(id, venueId).orElseThrow(() -> ApiException.notFound("tầng " + id));
        floors.delete(f);
    }

    // ---------- Vùng ----------
    @Override
    @Transactional(readOnly = true)
    public List<ZoneDto> listZones(Long venueId) {
        access.readable(venueId);
        return zones.findByFloor_Building_Venue_IdOrderBySortOrderAscIdAsc(venueId).stream().map(mapper::toDto).toList();
    }

    @Override
    public ZoneDto createZone(Long venueId, ZoneDto dto) {
        access.editable(venueId);
        Floor f = floors.findByIdAndBuilding_Venue_Id(dto.getFloorId(), venueId)
                .orElseThrow(() -> ApiException.notFound("tầng " + dto.getFloorId()));
        validatePolygon(dto);
        Zone z = Zone.builder().floor(f).name(dto.getName().trim()).color(dto.getColor()).polygon(dto.getPolygon())
                .sortOrder(dto.getSortOrder() == null ? 0 : dto.getSortOrder()).build();
        return mapper.toDto(zones.save(z));
    }

    @Override
    public ZoneDto updateZone(Long venueId, Long id, ZoneDto dto) {
        access.editable(venueId);
        Zone z = zones.findByIdAndFloor_Building_Venue_Id(id, venueId).orElseThrow(() -> ApiException.notFound("vùng " + id));
        if (dto.getFloorId() != null && !dto.getFloorId().equals(z.getFloor().getId())) {
            Floor f = floors.findByIdAndBuilding_Venue_Id(dto.getFloorId(), venueId)
                    .orElseThrow(() -> ApiException.notFound("tầng " + dto.getFloorId()));
            z.setFloor(f);
        }
        validatePolygon(dto);
        z.setName(dto.getName().trim());
        z.setColor(dto.getColor());
        z.setPolygon(dto.getPolygon());
        z.setSortOrder(dto.getSortOrder() == null ? 0 : dto.getSortOrder());
        return mapper.toDto(zones.save(z));
    }

    @Override
    public void deleteZone(Long venueId, Long id) {
        access.editable(venueId);
        Zone z = zones.findByIdAndFloor_Building_Venue_Id(id, venueId).orElseThrow(() -> ApiException.notFound("vùng " + id));
        zones.delete(z);
    }

    private static void validatePolygon(ZoneDto dto) {
        if (dto.getPolygon() == null || dto.getPolygon().size() < 3
                || dto.getPolygon().stream().anyMatch(p -> p == null || p.size() != 2)) {
            throw ApiException.badRequest("Vùng cần tối thiểu 3 điểm [x, y]");
        }
    }

    private static boolean bad(double[] pair) {
        return pair == null || pair.length != 2;
    }
}
