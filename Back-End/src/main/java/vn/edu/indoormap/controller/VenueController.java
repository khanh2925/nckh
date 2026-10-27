package vn.edu.indoormap.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import vn.edu.indoormap.dto.VenueDto;
import vn.edu.indoormap.dto.VenueMapDto;
import vn.edu.indoormap.service.VenueService;

import java.util.List;

// Địa điểm: phần công khai cho Viewer (theo slug) và phần Builder cho chủ địa điểm (theo id)
@RestController
@RequestMapping("/api")
public class VenueController {
    private final VenueService venues;

    public VenueController(VenueService venues) {
        this.venues = venues;
    }

    // ----- Công khai -----
    // GET /api/venues -> địa điểm đã xuất bản
    @GetMapping("/venues")
    public List<VenueDto> listPublished() {
        return venues.listPublished();
    }

    // GET /api/venues/tan-son-nhat
    @GetMapping("/venues/{slug:[a-z0-9-]+}")
    public VenueDto getBySlug(@PathVariable String slug) {
        return venues.getBySlug(slug);
    }

    // GET /api/venues/tan-son-nhat/map -> toà nhà, tầng, vùng, loại, địa điểm, lối đi
    @GetMapping("/venues/{slug:[a-z0-9-]+}/map")
    public VenueMapDto getMap(@PathVariable String slug) {
        return venues.getMap(slug);
    }

    // ----- Builder -----
    // GET /api/my/venues -> địa điểm của tôi (quản trị hệ thống: tất cả)
    @GetMapping("/my/venues")
    public List<VenueDto> listMine() {
        return venues.listMine();
    }

    @PostMapping("/venues")
    @ResponseStatus(HttpStatus.CREATED)
    public VenueDto create(@Valid @RequestBody VenueDto dto) {
        return venues.create(dto);
    }

    @PutMapping("/venues/{id:\\d+}")
    public VenueDto update(@PathVariable Long id, @Valid @RequestBody VenueDto dto) {
        return venues.update(id, dto);
    }

    @DeleteMapping("/venues/{id:\\d+}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        venues.delete(id);
    }

    @PostMapping("/venues/{id:\\d+}/publish")
    public VenueDto publish(@PathVariable Long id) {
        return venues.publish(id, true);
    }

    @PostMapping("/venues/{id:\\d+}/unpublish")
    public VenueDto unpublish(@PathVariable Long id) {
        return venues.publish(id, false);
    }
}
