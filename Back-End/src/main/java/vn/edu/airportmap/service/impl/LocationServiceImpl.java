package vn.edu.airportmap.service.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import vn.edu.airportmap.model.Location;
import vn.edu.airportmap.service.LocationService;

import java.io.IOException;
import java.io.InputStream;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;

@Service
public class LocationServiceImpl implements LocationService {
    private static final String DATA_FILE = "data/locations.json";

    // No database yet: data is kept in memory and resets when the server restarts.
    // CopyOnWriteArrayList / AtomicLong are safe when several requests arrive at the same time.
    private final List<Location> locations = new CopyOnWriteArrayList<>();
    private final AtomicLong nextId = new AtomicLong(1);

    private final ObjectMapper objectMapper;

    public LocationServiceImpl(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    // Runs once, right after Spring creates this service
    @PostConstruct
    public void loadSampleData() {
        try (InputStream input = new ClassPathResource(DATA_FILE).getInputStream()) {
            List<Location> sampleData = objectMapper.readValue(input, new TypeReference<List<Location>>() {});
            locations.addAll(sampleData);

            long maxId = sampleData.stream().mapToLong(Location::getId).max().orElse(0);
            nextId.set(maxId + 1);
        } catch (IOException e) {
            throw new RuntimeException("Cannot read " + DATA_FILE, e);
        }
    }

    @Override
    public List<Location> getLocations(Integer floor) {
        if (floor == null) {
            return locations;
        }
        return locations.stream()
                .filter(location -> floor.equals(location.getFloor()))
                .toList();
    }

    @Override
    public Location getLocationById(Long id) {
        return locations.stream()
                .filter(location -> location.getId().equals(id))
                .findFirst()
                .orElse(null);
    }

    @Override
    public Location addLocation(Location location) {
        location.setId(nextId.getAndIncrement());
        locations.add(location);
        return location;
    }
}
