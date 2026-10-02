package vn.edu.airportmap.controller;

import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import vn.edu.airportmap.model.WalkwayEdge;
import vn.edu.airportmap.model.WalkwayNetwork;
import vn.edu.airportmap.model.WalkwayNode;
import vn.edu.airportmap.service.WalkwayService;

import java.util.HashSet;
import java.util.Set;

@RestController
@RequestMapping("/api/walkways")
@CrossOrigin(origins = {"http://localhost:5173", "http://127.0.0.1:5173"})
public class WalkwayController {
    private final WalkwayService walkwayService;

    public WalkwayController(WalkwayService walkwayService) {
        this.walkwayService = walkwayService;
    }

    // GET /api/walkways  ->  { "nodes": [...], "edges": [...] }
    @GetMapping
    public WalkwayNetwork getWalkways() {
        return walkwayService.getWalkways();
    }

    // PUT /api/walkways  ->  replace the whole network with the one the admin drew
    @PutMapping
    public WalkwayNetwork saveWalkways(@RequestBody WalkwayNetwork network) {
        validate(network);
        try {
            return walkwayService.saveWalkways(network);
        } catch (IllegalArgumentException e) {
            throw badRequest(e.getMessage());
        }
    }

    // Every node needs a unique id, a floor and coordinates; every edge must join 2 different, existing nodes
    private void validate(WalkwayNetwork network) {
        if (network.getNodes() == null || network.getEdges() == null) {
            throw badRequest("Thiếu danh sách điểm hoặc đoạn đường");
        }

        Set<String> ids = new HashSet<>();
        for (WalkwayNode node : network.getNodes()) {
            if (node.getId() == null || node.getId().isBlank() || !ids.add(node.getId())) {
                throw badRequest("Mã điểm bị trống hoặc trùng: " + node.getId());
            }
            if (node.getTerminal() == null || node.getFloor() == null || node.getLat() == null || node.getLng() == null) {
                throw badRequest("Điểm " + node.getId() + " thiếu nhà ga, tầng hoặc tọa độ");
            }
            if (node.getConnector() != null && node.getConnector().isBlank()) {
                node.setConnector(null);
            }
        }

        for (WalkwayEdge edge : network.getEdges()) {
            if (!ids.contains(edge.getFrom()) || !ids.contains(edge.getTo()) || edge.getFrom().equals(edge.getTo())) {
                throw badRequest("Đoạn đường không hợp lệ: " + edge.getFrom() + " - " + edge.getTo());
            }
        }
    }

    private ResponseStatusException badRequest(String message) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, message);
    }
}
