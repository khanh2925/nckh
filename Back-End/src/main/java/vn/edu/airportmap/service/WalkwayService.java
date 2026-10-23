package vn.edu.airportmap.service;

import vn.edu.airportmap.model.WalkwayNetwork;

public interface WalkwayService {
    WalkwayNetwork getWalkways();
    WalkwayNetwork saveWalkways(WalkwayNetwork network);
}
