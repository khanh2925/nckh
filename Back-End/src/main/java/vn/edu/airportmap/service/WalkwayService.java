package vn.edu.airportmap.service;

import vn.edu.airportmap.dto.WalkwayNetworkDto;

public interface WalkwayService {
    WalkwayNetworkDto getWalkways();
    WalkwayNetworkDto saveWalkways(WalkwayNetworkDto network);
}
