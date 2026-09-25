package vn.edu.airportmap.service.impl;

import org.springframework.stereotype.Service;
import vn.edu.airportmap.dao.LocationDao;
import vn.edu.airportmap.model.Location;
import vn.edu.airportmap.service.LocationService;

import java.util.List;

@Service
public class LocationServiceImpl implements LocationService {
    private final LocationDao locationDao;

    public LocationServiceImpl(LocationDao locationDao) {
        this.locationDao = locationDao;
    }

    @Override
    public List<Location> getLocations(Integer floor) {
        List<Location> locations = locationDao.findAll();
        if (floor == null) {
            return locations;
        }
        return locations.stream()
                .filter(location -> floor.equals(location.getFloor()))
                .toList();
    }

    @Override
    public Location getLocationById(Long id) {
        return locationDao.findById(id);
    }

    @Override
    public Location addLocation(Location location) {
        location.setId(null);
        return locationDao.save(location);
    }

    // Returns null when the id does not exist
    @Override
    public Location updateLocation(Long id, Location location) {
        if (locationDao.findById(id) == null) {
            return null;
        }
        location.setId(id);
        return locationDao.save(location);
    }

    @Override
    public boolean deleteLocation(Long id) {
        return locationDao.deleteById(id);
    }
}
