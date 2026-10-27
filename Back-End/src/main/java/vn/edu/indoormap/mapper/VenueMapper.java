package vn.edu.indoormap.mapper;

import org.springframework.stereotype.Component;
import vn.edu.indoormap.dto.*;
import vn.edu.indoormap.entity.*;

// Chuyển entity <-> DTO cho venue, building, floor, zone, loại địa điểm, tiện ích
@Component
public class VenueMapper {

    public VenueDto toDto(Venue v) {
        return VenueDto.builder()
                .id(v.getId()).slug(v.getSlug()).name(v.getName()).kind(v.getKind())
                .description(v.getDescription()).centerLat(v.getCenterLat()).centerLng(v.getCenterLng())
                .outline(v.getOutline()).status(v.getStatus().name())
                .ownerId(v.getOwner() == null ? null : v.getOwner().getId())
                .ownerName(v.getOwner() == null ? null : v.getOwner().getFullName())
                .updatedAt(v.getUpdatedAt())
                .build();
    }

    // Các trường chủ địa điểm được sửa (slug/status/owner đổi qua service riêng)
    public void apply(VenueDto dto, Venue v) {
        v.setName(dto.getName().trim());
        if (dto.getKind() != null && !dto.getKind().isBlank()) {
            v.setKind(dto.getKind());
        }
        v.setDescription(dto.getDescription());
        v.setCenterLat(dto.getCenterLat());
        v.setCenterLng(dto.getCenterLng());
        v.setOutline(dto.getOutline());
    }

    public BuildingDto toDto(Building b) {
        return BuildingDto.builder()
                .id(b.getId()).venueId(b.getVenue().getId()).code(b.getCode()).name(b.getName())
                .centerLat(b.getCenterLat()).centerLng(b.getCenterLng()).outline(b.getOutline())
                .sortOrder(b.getSortOrder())
                .build();
    }

    public void apply(BuildingDto dto, Building b) {
        b.setCode(dto.getCode().trim());
        b.setName(dto.getName().trim());
        b.setCenterLat(dto.getCenterLat());
        b.setCenterLng(dto.getCenterLng());
        b.setOutline(dto.getOutline());
        b.setSortOrder(dto.getSortOrder() == null ? 0 : dto.getSortOrder());
    }

    public FloorDto toDto(Floor f) {
        return FloorDto.builder()
                .id(f.getId()).buildingId(f.getBuilding().getId()).buildingCode(f.getBuilding().getCode())
                .level(f.getLevel()).name(f.getName())
                .plan(toPlan(f))
                .build();
    }

    // plan = null khi tầng chưa có bản vẽ lẫn điểm mốc
    private FloorDto.PlanDto toPlan(Floor f) {
        if (f.getPlanSvg() == null && f.getPlanImageUrl() == null && f.getAnchorLat() == null) {
            return null;
        }
        FloorDto.ControlPoint anchor = f.getAnchorLat() == null ? null
                : new FloorDto.ControlPoint(new double[]{nz(f.getAnchorX()), nz(f.getAnchorY())}, new double[]{f.getAnchorLat(), nz(f.getAnchorLng())});
        FloorDto.ControlPoint end = f.getEndLat() == null ? null
                : new FloorDto.ControlPoint(new double[]{nz(f.getEndX()), nz(f.getEndY())}, new double[]{f.getEndLat(), nz(f.getEndLng())});
        return FloorDto.PlanDto.builder()
                .svg(f.getPlanSvg()).imageUrl(f.getPlanImageUrl())
                .width(f.getPlanWidth()).height(f.getPlanHeight())
                .anchor(anchor).end(end).depthScale(f.getDepthScale())
                .build();
    }

    public void applyPlan(FloorDto.PlanDto plan, Floor f) {
        if (plan == null) {
            f.setPlanSvg(null); f.setPlanImageUrl(null); f.setPlanWidth(null); f.setPlanHeight(null);
            f.setAnchorX(null); f.setAnchorY(null); f.setAnchorLat(null); f.setAnchorLng(null);
            f.setEndX(null); f.setEndY(null); f.setEndLat(null); f.setEndLng(null);
            f.setDepthScale(1.0);
            return;
        }
        f.setPlanSvg(plan.getSvg());
        f.setPlanImageUrl(plan.getImageUrl());
        f.setPlanWidth(plan.getWidth());
        f.setPlanHeight(plan.getHeight());
        if (plan.getAnchor() != null) {
            f.setAnchorX(plan.getAnchor().image()[0]); f.setAnchorY(plan.getAnchor().image()[1]);
            f.setAnchorLat(plan.getAnchor().latlng()[0]); f.setAnchorLng(plan.getAnchor().latlng()[1]);
        }
        if (plan.getEnd() != null) {
            f.setEndX(plan.getEnd().image()[0]); f.setEndY(plan.getEnd().image()[1]);
            f.setEndLat(plan.getEnd().latlng()[0]); f.setEndLng(plan.getEnd().latlng()[1]);
        }
        f.setDepthScale(plan.getDepthScale() == null || plan.getDepthScale() <= 0 ? 1.0 : plan.getDepthScale());
    }

    public ZoneDto toDto(Zone z) {
        return ZoneDto.builder()
                .id(z.getId()).floorId(z.getFloor().getId()).name(z.getName()).color(z.getColor())
                .polygon(z.getPolygon()).sortOrder(z.getSortOrder())
                .build();
    }

    public LocationTypeDto toDto(LocationType t) {
        return LocationTypeDto.builder()
                .id(t.getId()).code(t.getCode()).name(t.getName()).icon(t.getIcon()).color(t.getColor())
                .groupName(t.getGroupName()).sortOrder(t.getSortOrder())
                .build();
    }

    public LocationTypeDto toDto(TypeTemplate t) {
        return LocationTypeDto.builder()
                .id(t.getId()).kind(t.getKind()).code(t.getCode()).name(t.getName()).icon(t.getIcon())
                .color(t.getColor()).groupName(t.getGroupName()).sortOrder(t.getSortOrder())
                .build();
    }

    public FacilityDto toDto(Facility f) {
        return new FacilityDto(f.getId(), f.getName());
    }

    private static double nz(Double d) {
        return d == null ? 0 : d;
    }
}
