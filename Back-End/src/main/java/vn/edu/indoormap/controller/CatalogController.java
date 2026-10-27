package vn.edu.indoormap.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import vn.edu.indoormap.dto.FacilityDto;
import vn.edu.indoormap.dto.LocationTypeDto;
import vn.edu.indoormap.service.CatalogService;

import java.util.List;

// Loại địa điểm và tiện ích của một địa điểm
@RestController
@RequestMapping("/api/venues/{venueId:\\d+}")
public class CatalogController {
    private final CatalogService catalog;

    public CatalogController(CatalogService catalog) {
        this.catalog = catalog;
    }

    @GetMapping("/types")
    public List<LocationTypeDto> listTypes(@PathVariable Long venueId) {
        return catalog.listTypes(venueId);
    }

    @PostMapping("/types")
    @ResponseStatus(HttpStatus.CREATED)
    public LocationTypeDto createType(@PathVariable Long venueId, @Valid @RequestBody LocationTypeDto dto) {
        return catalog.createType(venueId, dto);
    }

    @PutMapping("/types/{id}")
    public LocationTypeDto updateType(@PathVariable Long venueId, @PathVariable Long id, @Valid @RequestBody LocationTypeDto dto) {
        return catalog.updateType(venueId, id, dto);
    }

    @DeleteMapping("/types/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteType(@PathVariable Long venueId, @PathVariable Long id) {
        catalog.deleteType(venueId, id);
    }

    // POST /api/venues/1/types/from-templates -> sao chép loại mẫu phù hợp loại hình
    @PostMapping("/types/from-templates")
    public List<LocationTypeDto> copyTemplates(@PathVariable Long venueId) {
        return catalog.copyTemplates(venueId);
    }

    @GetMapping("/facilities")
    public List<FacilityDto> listFacilities(@PathVariable Long venueId) {
        return catalog.listFacilities(venueId);
    }

    @PostMapping("/facilities")
    @ResponseStatus(HttpStatus.CREATED)
    public FacilityDto createFacility(@PathVariable Long venueId, @Valid @RequestBody FacilityDto dto) {
        return catalog.createFacility(venueId, dto);
    }

    @PutMapping("/facilities/{id}")
    public FacilityDto updateFacility(@PathVariable Long venueId, @PathVariable Long id, @Valid @RequestBody FacilityDto dto) {
        return catalog.updateFacility(venueId, id, dto);
    }

    @DeleteMapping("/facilities/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteFacility(@PathVariable Long venueId, @PathVariable Long id) {
        catalog.deleteFacility(venueId, id);
    }
}
