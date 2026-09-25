package vn.edu.airportmap.dao;

import vn.edu.airportmap.model.Location;

import java.util.List;

public interface LocationDao {
    List<Location> findAll();
    Location findById(Long id);

    // id == null -> add new, otherwise -> replace the location with the same id
    Location save(Location location);

    boolean deleteById(Long id);
}
