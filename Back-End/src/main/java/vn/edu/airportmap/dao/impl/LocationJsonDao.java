package vn.edu.airportmap.dao.impl;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Repository;
import vn.edu.airportmap.dao.LocationDao;
import vn.edu.airportmap.model.Location;

import java.io.File;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

// Stores locations in a JSON file (no database yet).
// The whole list is kept in memory and the file is rewritten after every change.
// Later, a JPA/PostgreSQL version can implement LocationDao without touching the service or controller.
@Repository
public class LocationJsonDao implements LocationDao {
    private static final Logger log = LoggerFactory.getLogger(LocationJsonDao.class);

    private final ObjectMapper objectMapper;
    private final File dataFile;
    private final List<Location> locations = new ArrayList<>();
    private long nextId = 1;

    // Path comes from application.properties (relative to the folder you run the backend from)
    public LocationJsonDao(ObjectMapper objectMapper, @Value("${app.data-file}") String dataFilePath) {
        this.objectMapper = objectMapper;
        this.dataFile = new File(dataFilePath);
    }

    @PostConstruct
    public synchronized void load() {
        try {
            if (!dataFile.exists()) {
                log.warn("Data file not found, creating an empty one: {}", dataFile.getAbsolutePath());
                writeFile();
                return;
            }
            locations.addAll(objectMapper.readValue(dataFile, new TypeReference<List<Location>>() {}));
            nextId = locations.stream().mapToLong(Location::getId).max().orElse(0) + 1;
            log.info("Loaded {} locations from {}", locations.size(), dataFile.getAbsolutePath());
        } catch (IOException e) {
            throw new RuntimeException("Cannot read " + dataFile.getAbsolutePath(), e);
        }
    }

    // "synchronized": only one request at a time may read/change the list and the file
    @Override
    public synchronized List<Location> findAll() {
        return new ArrayList<>(locations);
    }

    @Override
    public synchronized Location findById(Long id) {
        return locations.stream()
                .filter(location -> location.getId().equals(id))
                .findFirst()
                .orElse(null);
    }

    @Override
    public synchronized Location save(Location location) {
        if (location.getId() == null) {
            location.setId(nextId++);
            locations.add(location);
        } else {
            locations.replaceAll(item -> item.getId().equals(location.getId()) ? location : item);
        }
        writeFile();
        return location;
    }

    @Override
    public synchronized boolean deleteById(Long id) {
        boolean removed = locations.removeIf(location -> location.getId().equals(id));
        if (removed) {
            writeFile();
        }
        return removed;
    }

    private void writeFile() {
        try {
            File folder = dataFile.getAbsoluteFile().getParentFile();
            if (folder != null) {
                folder.mkdirs();
            }
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(dataFile, locations);
        } catch (IOException e) {
            throw new RuntimeException("Cannot write " + dataFile.getAbsolutePath(), e);
        }
    }
}
