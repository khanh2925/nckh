package vn.edu.indoormap.service;

import vn.edu.indoormap.dto.WalkwayNetworkDto;

public interface WalkwayService {
    WalkwayNetworkDto get(Long venueId);
    WalkwayNetworkDto replace(Long venueId, WalkwayNetworkDto network);
}
