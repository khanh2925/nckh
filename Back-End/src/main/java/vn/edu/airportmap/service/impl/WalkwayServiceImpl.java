package vn.edu.airportmap.service.impl;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.airportmap.dao.WalkwayDao;
import vn.edu.airportmap.model.WalkwayEdge;
import vn.edu.airportmap.model.WalkwayNetwork;
import vn.edu.airportmap.service.WalkwayService;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.Map;

@Service
@Transactional
public class WalkwayServiceImpl implements WalkwayService {
    private final WalkwayDao walkwayDao;

    public WalkwayServiceImpl(WalkwayDao walkwayDao) {
        this.walkwayDao = walkwayDao;
    }

    @Override
    public WalkwayNetwork getWalkways() {
        return walkwayDao.findAll();
    }

    @Override
    public WalkwayNetwork saveWalkways(WalkwayNetwork network) {
        // A-B and B-A are the same segment: keep only one copy
        Map<String, WalkwayEdge> edges = new LinkedHashMap<>();
        for (WalkwayEdge edge : network.getEdges()) {
            String key = edge.getFrom().compareTo(edge.getTo()) < 0
                    ? edge.getFrom() + "|" + edge.getTo()
                    : edge.getTo() + "|" + edge.getFrom();
            edges.putIfAbsent(key, edge);
        }
        network.setEdges(new ArrayList<>(edges.values()));

        walkwayDao.replaceAll(network);
        return walkwayDao.findAll();
    }
}
