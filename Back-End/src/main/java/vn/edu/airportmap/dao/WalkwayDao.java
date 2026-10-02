package vn.edu.airportmap.dao;

import vn.edu.airportmap.model.WalkwayNetwork;

public interface WalkwayDao {
    WalkwayNetwork findAll();

    // Deletes the old network and saves this one instead
    void replaceAll(WalkwayNetwork network);
}
