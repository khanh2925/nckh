package vn.edu.indoormap.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.indoormap.dto.ImportResultDto;
import vn.edu.indoormap.dto.LocationDto;
import vn.edu.indoormap.entity.*;
import vn.edu.indoormap.exception.ApiException;
import vn.edu.indoormap.mapper.LocationMapper;
import vn.edu.indoormap.repository.FacilityRepository;
import vn.edu.indoormap.repository.FloorRepository;
import vn.edu.indoormap.repository.LocationRepository;
import vn.edu.indoormap.repository.LocationTypeRepository;
import vn.edu.indoormap.security.VenueAccess;
import vn.edu.indoormap.service.LocationService;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@Transactional
public class LocationServiceImpl implements LocationService {
    private final LocationRepository locations;
    private final FloorRepository floors;
    private final LocationTypeRepository types;
    private final FacilityRepository facilities;
    private final LocationMapper mapper;
    private final VenueAccess access;

    public LocationServiceImpl(LocationRepository locations, FloorRepository floors, LocationTypeRepository types,
                               FacilityRepository facilities, LocationMapper mapper, VenueAccess access) {
        this.locations = locations; this.floors = floors; this.types = types;
        this.facilities = facilities; this.mapper = mapper; this.access = access;
    }

    @Override
    @Transactional(readOnly = true)
    public List<LocationDto> list(Long venueId, Long floorId) {
        access.readable(venueId);
        List<Location> list = floorId == null
                ? locations.findByFloor_Building_Venue_IdOrderByIdAsc(venueId)
                : locations.findByFloor_IdOrderByIdAsc(floorId).stream()
                    .filter(l -> l.getFloor().getBuilding().getVenue().getId().equals(venueId)).toList();
        return list.stream().map(mapper::toDto).toList();
    }

    @Override
    @Transactional(readOnly = true)
    public LocationDto get(Long venueId, Long id) {
        access.readable(venueId);
        return mapper.toDto(find(venueId, id));
    }

    @Override
    public LocationDto create(Long venueId, LocationDto dto) {
        access.editable(venueId);
        validate(dto);
        Location e = new Location();
        fill(venueId, dto, e);
        return mapper.toDto(locations.save(e));
    }

    @Override
    public LocationDto update(Long venueId, Long id, LocationDto dto) {
        access.editable(venueId);
        validate(dto);
        Location e = find(venueId, id);
        fill(venueId, dto, e);
        return mapper.toDto(locations.save(e));
    }

    @Override
    public void delete(Long venueId, Long id) {
        access.editable(venueId);
        locations.delete(find(venueId, id));
    }

    // Nhập hàng loạt (từ CSV/GeoJSON đã được frontend chuyển thành LocationDto). Dòng lỗi được bỏ qua và báo lại.
    @Override
    public ImportResultDto importMany(Long venueId, List<LocationDto> items) {
        access.editable(venueId);
        int imported = 0;
        List<String> errors = new ArrayList<>();
        for (int i = 0; i < items.size(); i++) {
            LocationDto dto = items.get(i);
            try {
                validate(dto);
                Location e = new Location();
                fill(venueId, dto, e);
                locations.save(e);
                imported++;
            } catch (ApiException ex) {
                errors.add("Dòng " + (i + 1) + ": " + ex.getReason());
            }
        }
        return new ImportResultDto(imported, items.size() - imported, errors);
    }

    private Location find(Long venueId, Long id) {
        return locations.findByIdAndFloor_Building_Venue_Id(id, venueId).orElseThrow(() -> ApiException.notFound("địa điểm " + id));
    }

    private static void validate(LocationDto dto) {
        if (dto.getName() == null || dto.getName().isBlank()) {
            throw ApiException.badRequest("Tên địa điểm không được để trống");
        }
        if (dto.getFloorId() == null) {
            throw ApiException.badRequest("Thiếu tầng (floorId)");
        }
        if ((dto.getX() == null || dto.getY() == null) && (dto.getLat() == null || dto.getLng() == null)) {
            throw ApiException.badRequest("Thiếu toạ độ: cần (x, y) trên bản vẽ hoặc (lat, lng)");
        }
        if (dto.getFacilities() != null) {
            Set<String> seen = new HashSet<>();
            for (String f : dto.getFacilities()) {
                if (f == null || f.isBlank() || !seen.add(f.trim().toLowerCase())) {
                    throw ApiException.badRequest("Tiện ích không được trống hoặc trùng lặp");
                }
            }
        }
    }

    private void fill(Long venueId, LocationDto dto, Location e) {
        Floor floor = floors.findByIdAndBuilding_Venue_Id(dto.getFloorId(), venueId)
                .orElseThrow(() -> ApiException.notFound("tầng " + dto.getFloorId()));
        e.setFloor(floor);
        if (e.getFacilities() == null) {
            e.setFacilities(new ArrayList<>());
        }
        mapper.apply(dto, e);

        String typeCode = dto.getType() == null || dto.getType().isBlank() ? null : dto.getType().trim();
        if (typeCode == null) {
            e.setType(types.findByVenue_IdAndCode(venueId, "other").orElse(null));
        } else {
            e.setType(types.findByVenue_IdAndCode(venueId, typeCode)
                    .orElseThrow(() -> ApiException.badRequest("Loại địa điểm '" + typeCode + "' chưa được định nghĩa cho địa điểm này")));
        }

        if (dto.getFacilities() == null) {
            e.setFacilitiesKnown(false);
            e.getFacilities().clear();
        } else {
            e.setFacilitiesKnown(true);
            Venue venue = floor.getBuilding().getVenue();
            List<Facility> list = new ArrayList<>();
            for (String name : dto.getFacilities()) {
                String clean = name.trim();
                // Tiện ích chưa có thì tạo mới cho venue
                list.add(facilities.findByVenue_IdAndNameIgnoreCase(venueId, clean)
                        .orElseGet(() -> facilities.save(Facility.builder().venue(venue).name(clean).build())));
            }
            e.getFacilities().clear();
            e.getFacilities().addAll(list);
        }
    }
}
