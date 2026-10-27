package vn.edu.indoormap.controller;

import org.springframework.web.bind.annotation.*;
import vn.edu.indoormap.dto.WalkwayNetworkDto;
import vn.edu.indoormap.service.WalkwayService;

// Mạng lối đi của một địa điểm
@RestController
@RequestMapping("/api/venues/{venueId:\\d+}/walkways")
public class WalkwayController {
    private final WalkwayService walkways;

    public WalkwayController(WalkwayService walkways) {
        this.walkways = walkways;
    }

    // GET /api/venues/1/walkways -> { nodes: [...], edges: [...] }
    @GetMapping
    public WalkwayNetworkDto get(@PathVariable Long venueId) {
        return walkways.get(venueId);
    }

    // PUT /api/venues/1/walkways -> thay toàn bộ mạng bằng bản Builder vừa vẽ
    @PutMapping
    public WalkwayNetworkDto replace(@PathVariable Long venueId, @RequestBody WalkwayNetworkDto network) {
        return walkways.replace(venueId, network);
    }
}
