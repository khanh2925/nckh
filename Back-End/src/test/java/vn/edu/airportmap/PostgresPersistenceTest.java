package vn.edu.airportmap;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.airportmap.dao.LocationDao;
import vn.edu.airportmap.dao.impl.DatabaseLocationImporter;
import vn.edu.airportmap.model.Location;
import java.io.File;
import java.util.Comparator;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

// Opt in against a local PostgreSQL database; test CRUD rolls back automatically.
@SpringBootTest
@ActiveProfiles("postgres")
@EnabledIfEnvironmentVariable(named="DB_INTEGRATION_TEST", matches="true")
@Transactional
class PostgresPersistenceTest {
    @Autowired LocationDao dao;
    @Autowired ObjectMapper mapper;
    @Autowired DatabaseLocationImporter importer;

    @Test void initialImportPreservesEveryField() throws Exception {
        List<Location> source = mapper.readValue(new File("data/airport-locations.json"), new TypeReference<>() {});
        source.sort(Comparator.comparing(Location::getId));
        assertEquals(mapper.valueToTree(source), mapper.valueToTree(dao.findAll()));
    }

    @Test void crudAndRepeatedImportPreserveDatabaseChanges() {
        var original = dao.findAll();
        long max = original.stream().mapToLong(Location::getId).max().orElseThrow();
        var location = Location.builder().name("Kiểm thử PostgreSQL").terminal("T1").floor(0)
                .x(123.5).y(45.25).lat(10.8).lng(106.6).facilities(List.of("Wi-Fi", "Tiện ích")).build();
        dao.save(location);
        assertTrue(location.getId() > max);
        assertEquals(mapper.valueToTree(location), mapper.valueToTree(dao.findById(location.getId())));
        location.setName("Đã cập nhật");
        location.setFacilities(List.of());
        dao.save(location);
        assertEquals(mapper.valueToTree(location), mapper.valueToTree(dao.findById(location.getId())));
        assertTrue(dao.deleteById(original.get(0).getId()));
        importer.run(null);
        assertNull(dao.findById(original.get(0).getId()));
        assertNotNull(dao.findById(location.getId()));
        assertTrue(dao.deleteById(location.getId()));
        assertFalse(dao.deleteById(location.getId()));
    }
}
