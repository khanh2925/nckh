package vn.edu.indoormap.controller;

import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import vn.edu.indoormap.dto.JourneyDto;
import vn.edu.indoormap.service.JourneyService;

import java.util.List;

// Quy trình (hành trình nhiều bước) của một địa điểm
@RestController
@RequestMapping("/api/venues/{venueId:\\d+}/journeys")
public class JourneyController {
    private final JourneyService journeys;

    public JourneyController(JourneyService journeys) {
        this.journeys = journeys;
    }

    @GetMapping
    public List<JourneyDto> list(@PathVariable Long venueId) {
        return journeys.list(venueId);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public JourneyDto create(@PathVariable Long venueId, @Valid @RequestBody JourneyDto dto) {
        return journeys.create(venueId, dto);
    }

    @PutMapping("/{id}")
    public JourneyDto update(@PathVariable Long venueId, @PathVariable Long id, @Valid @RequestBody JourneyDto dto) {
        return journeys.update(venueId, id, dto);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long venueId, @PathVariable Long id) {
        journeys.delete(venueId, id);
    }
}
