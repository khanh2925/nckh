package vn.edu.indoormap.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.indoormap.dto.*;
import vn.edu.indoormap.entity.User;
import vn.edu.indoormap.entity.Venue;
import vn.edu.indoormap.exception.ApiException;
import vn.edu.indoormap.mapper.LocationMapper;
import vn.edu.indoormap.mapper.VenueMapper;
import vn.edu.indoormap.mapper.WalkwayMapper;
import vn.edu.indoormap.repository.*;
import vn.edu.indoormap.security.CurrentUser;
import vn.edu.indoormap.security.VenueAccess;
import vn.edu.indoormap.service.CatalogService;
import vn.edu.indoormap.service.VenueService;

import java.util.List;

@Service
@Transactional
public class VenueServiceImpl implements VenueService {
    private final VenueRepository venues;
    private final BuildingRepository buildings;
    private final FloorRepository floors;
    private final ZoneRepository zones;
    private final LocationTypeRepository types;
    private final FacilityRepository facilities;
    private final LocationRepository locations;
    private final WalkwayNodeRepository nodes;
    private final WalkwayEdgeRepository edges;
    private final VenueMapper venueMapper;
    private final LocationMapper locationMapper;
    private final WalkwayMapper walkwayMapper;
    private final VenueAccess access;
    private final CurrentUser currentUser;
    private final CatalogService catalog;

    public VenueServiceImpl(VenueRepository venues, BuildingRepository buildings, FloorRepository floors, ZoneRepository zones,
                            LocationTypeRepository types, FacilityRepository facilities, LocationRepository locations,
                            WalkwayNodeRepository nodes, WalkwayEdgeRepository edges, VenueMapper venueMapper,
                            LocationMapper locationMapper, WalkwayMapper walkwayMapper, VenueAccess access,
                            CurrentUser currentUser, CatalogService catalog) {
        this.venues = venues; this.buildings = buildings; this.floors = floors; this.zones = zones;
        this.types = types; this.facilities = facilities; this.locations = locations;
        this.nodes = nodes; this.edges = edges; this.venueMapper = venueMapper;
        this.locationMapper = locationMapper; this.walkwayMapper = walkwayMapper; this.access = access;
        this.currentUser = currentUser; this.catalog = catalog;
    }

    @Override
    @Transactional(readOnly = true)
    public List<VenueDto> listPublished() {
        return venues.findByStatusOrderByNameAsc(Venue.Status.PUBLISHED).stream().map(this::summary).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public VenueDto getBySlug(String slug) {
        return summary(access.readableBySlug(slug));
    }

    // Toàn bộ dữ liệu Viewer cần trong một lần gọi
    @Override
    @Transactional(readOnly = true)
    public VenueMapDto getMap(String slug) {
        Venue venue = access.readableBySlug(slug);
        Long id = venue.getId();
        return VenueMapDto.builder()
                .venue(summary(venue))
                .buildings(buildings.findByVenue_IdOrderBySortOrderAscIdAsc(id).stream().map(venueMapper::toDto).toList())
                .floors(floors.findByBuilding_Venue_IdOrderByBuilding_SortOrderAscLevelAsc(id).stream().map(venueMapper::toDto).toList())
                .zones(zones.findByFloor_Building_Venue_IdOrderBySortOrderAscIdAsc(id).stream().map(venueMapper::toDto).toList())
                .types(types.findByVenue_IdOrderBySortOrderAscNameAsc(id).stream().map(venueMapper::toDto).toList())
                .facilities(facilities.findByVenue_IdOrderByNameAsc(id).stream().map(venueMapper::toDto).toList())
                .locations(locations.findByFloor_Building_Venue_IdOrderByIdAsc(id).stream().map(locationMapper::toDto).toList())
                .walkways(new WalkwayNetworkDto(
                        nodes.findByFloor_Building_Venue_IdOrderByIdAsc(id).stream().map(walkwayMapper::toDto).toList(),
                        edges.findByVenueId(id).stream().map(walkwayMapper::toDto).toList()))
                .build();
    }

    @Override
    @Transactional(readOnly = true)
    public List<VenueDto> listMine() {
        User user = currentUser.require();
        List<Venue> list = user.getRole() == User.Role.SYSTEM_ADMIN
                ? venues.findAllByOrderByUpdatedAtDesc()
                : venues.findByOwner_IdOrderByUpdatedAtDesc(user.getId());
        return list.stream().map(this::summary).toList();
    }

    @Override
    public VenueDto create(VenueDto dto) {
        User user = currentUser.require();
        if (venues.existsBySlug(dto.getSlug())) {
            throw ApiException.conflict("Đường dẫn (slug) '" + dto.getSlug() + "' đã được dùng");
        }
        Venue venue = Venue.builder().slug(dto.getSlug()).owner(user).build();
        venueMapper.apply(dto, venue);
        venue = venues.save(venue);
        // Địa điểm mới có sẵn các loại địa điểm mẫu theo loại hình
        catalog.copyTemplates(venue.getId());
        return summary(venue);
    }

    @Override
    public VenueDto update(Long id, VenueDto dto) {
        Venue venue = access.editable(id);
        if (!venue.getSlug().equals(dto.getSlug())) {
            if (venues.existsBySlug(dto.getSlug())) {
                throw ApiException.conflict("Đường dẫn (slug) '" + dto.getSlug() + "' đã được dùng");
            }
            venue.setSlug(dto.getSlug());
        }
        venueMapper.apply(dto, venue);
        return summary(venues.save(venue));
    }

    @Override
    public void delete(Long id) {
        Venue venue = access.editable(id);
        venues.delete(venue);   // ON DELETE CASCADE dọn toà nhà, tầng, địa điểm, lối đi
    }

    // Xuất bản: khách tham quan xem được. Địa điểm bị quản trị hệ thống ẩn (HIDDEN) thì chủ không tự bật lại được.
    @Override
    public VenueDto publish(Long id, boolean published) {
        Venue venue = access.editable(id);
        if (venue.getStatus() == Venue.Status.HIDDEN && !currentUser.isSystemAdmin()) {
            throw ApiException.forbidden("Địa điểm đang bị quản trị hệ thống ẩn");
        }
        venue.setStatus(published ? Venue.Status.PUBLISHED : Venue.Status.DRAFT);
        return summary(venues.save(venue));
    }

    private VenueDto summary(Venue venue) {
        VenueDto dto = venueMapper.toDto(venue);
        dto.setBuildingCount(buildings.findByVenue_IdOrderBySortOrderAscIdAsc(venue.getId()).size());
        dto.setFloorCount(floors.findByBuilding_Venue_IdOrderByBuilding_SortOrderAscLevelAsc(venue.getId()).size());
        dto.setLocationCount(locations.countByFloor_Building_Venue_Id(venue.getId()));
        return dto;
    }
}
