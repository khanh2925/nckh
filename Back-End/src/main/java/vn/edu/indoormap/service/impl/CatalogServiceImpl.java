package vn.edu.indoormap.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.indoormap.dto.FacilityDto;
import vn.edu.indoormap.dto.LocationTypeDto;
import vn.edu.indoormap.entity.Facility;
import vn.edu.indoormap.entity.LocationType;
import vn.edu.indoormap.entity.TypeTemplate;
import vn.edu.indoormap.entity.Venue;
import vn.edu.indoormap.exception.ApiException;
import vn.edu.indoormap.mapper.VenueMapper;
import vn.edu.indoormap.repository.FacilityRepository;
import vn.edu.indoormap.repository.LocationTypeRepository;
import vn.edu.indoormap.repository.TypeTemplateRepository;
import vn.edu.indoormap.security.VenueAccess;
import vn.edu.indoormap.service.CatalogService;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@Transactional
public class CatalogServiceImpl implements CatalogService {
    private final LocationTypeRepository types;
    private final FacilityRepository facilities;
    private final TypeTemplateRepository templates;
    private final VenueMapper mapper;
    private final VenueAccess access;

    public CatalogServiceImpl(LocationTypeRepository types, FacilityRepository facilities,
                              TypeTemplateRepository templates, VenueMapper mapper, VenueAccess access) {
        this.types = types; this.facilities = facilities; this.templates = templates; this.mapper = mapper; this.access = access;
    }

    // ---------- Loại địa điểm của venue ----------
    @Override
    @Transactional(readOnly = true)
    public List<LocationTypeDto> listTypes(Long venueId) {
        access.readable(venueId);
        return types.findByVenue_IdOrderBySortOrderAscNameAsc(venueId).stream().map(mapper::toDto).toList();
    }

    @Override
    public LocationTypeDto createType(Long venueId, LocationTypeDto dto) {
        Venue venue = access.editable(venueId);
        if (types.findByVenue_IdAndCode(venueId, dto.getCode()).isPresent()) {
            throw ApiException.conflict("Mã loại '" + dto.getCode() + "' đã có");
        }
        LocationType t = LocationType.builder().venue(venue).code(dto.getCode()).build();
        applyType(dto, t);
        return mapper.toDto(types.save(t));
    }

    @Override
    public LocationTypeDto updateType(Long venueId, Long id, LocationTypeDto dto) {
        access.editable(venueId);
        LocationType t = types.findByIdAndVenue_Id(id, venueId).orElseThrow(() -> ApiException.notFound("loại địa điểm " + id));
        if (!t.getCode().equals(dto.getCode()) && types.findByVenue_IdAndCode(venueId, dto.getCode()).isPresent()) {
            throw ApiException.conflict("Mã loại '" + dto.getCode() + "' đã có");
        }
        t.setCode(dto.getCode());
        applyType(dto, t);
        return mapper.toDto(types.save(t));
    }

    // Xoá loại: địa điểm thuộc loại đó chuyển về không có loại (ON DELETE SET NULL)
    @Override
    public void deleteType(Long venueId, Long id) {
        access.editable(venueId);
        LocationType t = types.findByIdAndVenue_Id(id, venueId).orElseThrow(() -> ApiException.notFound("loại địa điểm " + id));
        types.delete(t);
    }

    @Override
    public List<LocationTypeDto> copyTemplates(Long venueId) {
        Venue venue = access.editable(venueId);
        Set<String> existing = types.findByVenue_IdOrderBySortOrderAscNameAsc(venueId).stream()
                .map(LocationType::getCode).collect(Collectors.toSet());
        for (TypeTemplate tpl : templates.findByKindInOrderBySortOrderAscNameAsc(List.of("all", venue.getKind()))) {
            if (existing.add(tpl.getCode())) {
                types.save(LocationType.builder().venue(venue).code(tpl.getCode()).name(tpl.getName())
                        .icon(tpl.getIcon()).color(tpl.getColor()).groupName(tpl.getGroupName())
                        .sortOrder(tpl.getSortOrder()).build());
            }
        }
        return types.findByVenue_IdOrderBySortOrderAscNameAsc(venueId).stream().map(mapper::toDto).toList();
    }

    // ---------- Tiện ích của venue ----------
    @Override
    @Transactional(readOnly = true)
    public List<FacilityDto> listFacilities(Long venueId) {
        access.readable(venueId);
        return facilities.findByVenue_IdOrderByNameAsc(venueId).stream().map(mapper::toDto).toList();
    }

    @Override
    public FacilityDto createFacility(Long venueId, FacilityDto dto) {
        Venue venue = access.editable(venueId);
        String name = dto.name().trim();
        if (facilities.findByVenue_IdAndNameIgnoreCase(venueId, name).isPresent()) {
            throw ApiException.conflict("Tiện ích '" + name + "' đã có");
        }
        return mapper.toDto(facilities.save(Facility.builder().venue(venue).name(name).build()));
    }

    @Override
    public FacilityDto updateFacility(Long venueId, Long id, FacilityDto dto) {
        access.editable(venueId);
        Facility f = facilities.findByIdAndVenue_Id(id, venueId).orElseThrow(() -> ApiException.notFound("tiện ích " + id));
        String name = dto.name().trim();
        facilities.findByVenue_IdAndNameIgnoreCase(venueId, name).filter(other -> !other.getId().equals(id))
                .ifPresent(other -> { throw ApiException.conflict("Tiện ích '" + name + "' đã có"); });
        f.setName(name);
        return mapper.toDto(facilities.save(f));
    }

    @Override
    public void deleteFacility(Long venueId, Long id) {
        access.editable(venueId);
        Facility f = facilities.findByIdAndVenue_Id(id, venueId).orElseThrow(() -> ApiException.notFound("tiện ích " + id));
        facilities.delete(f);
    }

    // ---------- Danh mục mẫu (quản trị hệ thống) ----------
    @Override
    @Transactional(readOnly = true)
    public List<LocationTypeDto> listTemplates() {
        return templates.findAllByOrderByKindAscSortOrderAscNameAsc().stream().map(mapper::toDto).toList();
    }

    @Override
    public LocationTypeDto createTemplate(LocationTypeDto dto) {
        TypeTemplate t = TypeTemplate.builder().build();
        applyTemplate(dto, t);
        return mapper.toDto(templates.save(t));
    }

    @Override
    public LocationTypeDto updateTemplate(Long id, LocationTypeDto dto) {
        TypeTemplate t = templates.findById(id).orElseThrow(() -> ApiException.notFound("loại mẫu " + id));
        applyTemplate(dto, t);
        return mapper.toDto(templates.save(t));
    }

    @Override
    public void deleteTemplate(Long id) {
        if (!templates.existsById(id)) {
            throw ApiException.notFound("loại mẫu " + id);
        }
        templates.deleteById(id);
    }

    private static void applyType(LocationTypeDto dto, LocationType t) {
        t.setName(dto.getName().trim());
        t.setIcon(dto.getIcon());
        t.setColor(dto.getColor());
        t.setGroupName(dto.getGroupName());
        t.setSortOrder(dto.getSortOrder() == null ? 0 : dto.getSortOrder());
    }

    private static void applyTemplate(LocationTypeDto dto, TypeTemplate t) {
        t.setKind(dto.getKind() == null || dto.getKind().isBlank() ? "all" : dto.getKind());
        t.setCode(dto.getCode());
        t.setName(dto.getName().trim());
        t.setIcon(dto.getIcon());
        t.setColor(dto.getColor());
        t.setGroupName(dto.getGroupName());
        t.setSortOrder(dto.getSortOrder() == null ? 0 : dto.getSortOrder());
    }
}
