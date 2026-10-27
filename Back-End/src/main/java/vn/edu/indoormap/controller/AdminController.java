package vn.edu.indoormap.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import vn.edu.indoormap.dto.AuthDtos.UserDto;
import vn.edu.indoormap.dto.LocationTypeDto;
import vn.edu.indoormap.dto.VenueDto;
import vn.edu.indoormap.service.AdminService;
import vn.edu.indoormap.service.CatalogService;

import java.util.List;
import java.util.Map;

// Quản trị hệ thống (ROLE_SYSTEM_ADMIN, xem SecurityConfig): người dùng, kiểm duyệt địa điểm, danh mục mẫu
@RestController
@RequestMapping("/api/admin")
public class AdminController {
    private final AdminService admin;
    private final CatalogService catalog;

    public AdminController(AdminService admin, CatalogService catalog) {
        this.admin = admin;
        this.catalog = catalog;
    }

    // GET /api/admin/users?status=PENDING
    @GetMapping("/users")
    public List<UserDto> listUsers(@RequestParam(required = false) String status) {
        return admin.listUsers(status);
    }

    // PUT /api/admin/users/5/status { "status": "ACTIVE" | "LOCKED" }
    @PutMapping("/users/{id}/status")
    public UserDto setUserStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return admin.setUserStatus(id, body.getOrDefault("status", ""));
    }

    @GetMapping("/venues")
    public List<VenueDto> listVenues() {
        return admin.listVenues();
    }

    // PUT /api/admin/venues/1/status { "status": "PUBLISHED" | "HIDDEN" | "DRAFT" }
    @PutMapping("/venues/{id}/status")
    public VenueDto setVenueStatus(@PathVariable Long id, @RequestBody Map<String, String> body) {
        return admin.setVenueStatus(id, body.getOrDefault("status", ""));
    }

    // PUT /api/admin/venues/1/owner { "ownerId": 3 }
    @PutMapping("/venues/{id}/owner")
    public VenueDto setVenueOwner(@PathVariable Long id, @RequestBody Map<String, Long> body) {
        return admin.setVenueOwner(id, body.get("ownerId"));
    }

    @GetMapping("/type-templates")
    public List<LocationTypeDto> listTemplates() {
        return catalog.listTemplates();
    }

    @PostMapping("/type-templates")
    @ResponseStatus(HttpStatus.CREATED)
    public LocationTypeDto createTemplate(@Valid @RequestBody LocationTypeDto dto) {
        return catalog.createTemplate(dto);
    }

    @PutMapping("/type-templates/{id}")
    public LocationTypeDto updateTemplate(@PathVariable Long id, @Valid @RequestBody LocationTypeDto dto) {
        return catalog.updateTemplate(id, dto);
    }

    @DeleteMapping("/type-templates/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteTemplate(@PathVariable Long id) {
        catalog.deleteTemplate(id);
    }
}
