package vn.edu.airportmap;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.airportmap.dto.LocationDto;
import vn.edu.airportmap.service.LocationService;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

// Opt in against a local PostgreSQL database; test CRUD goes through the JPA service and rolls back automatically.
@SpringBootTest
@EnabledIfEnvironmentVariable(named="DB_INTEGRATION_TEST", matches="true")
@Transactional
class PostgresPersistenceTest {
    @Autowired LocationService service;
    @Autowired jakarta.persistence.EntityManager entityManager;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;

    @Test void seedIncludesRelationalData() {
        assertEquals(705, service.getLocations(null).size());
        assertEquals(4, jdbc.queryForObject("SELECT count(*) FROM terminals", Integer.class));
        assertEquals(11, jdbc.queryForObject("SELECT count(*) FROM floors", Integer.class));
        assertEquals(18, jdbc.queryForObject("SELECT count(*) FROM location_types", Integer.class));
        assertEquals(167, jdbc.queryForObject("SELECT count(*) FROM location_facilities", Integer.class));
    }

    @Test void foreignKeysAndUniqueConstraintsRejectInvalidRelations() {
        reject("INSERT INTO floors(terminal_code,level,name) VALUES ('missing-terminal',99,'Invalid')");
        reject("INSERT INTO floors(terminal_code,level,name) SELECT terminal_code,level,name FROM floors LIMIT 1");
        reject("UPDATE locations SET floor_id = -1 WHERE id = (SELECT min(id) FROM locations)");
        reject("UPDATE locations SET type_code = 'missing-type' WHERE id = (SELECT min(id) FROM locations)");
        reject("INSERT INTO location_facilities(location_id,facility_id,position) VALUES (-1,-1,0)");
    }

    // Writes pending JPA changes so the JdbcTemplate checks below see them, then reloads from the database
    private void flush() {
        entityManager.flush();
        entityManager.clear();
    }

    private void reject(String sql) {
        jdbc.execute("SAVEPOINT constraint_check");
        try {
            assertThrows(org.springframework.dao.DataIntegrityViolationException.class, () -> jdbc.execute(sql));
        } finally {
            jdbc.execute("ROLLBACK TO SAVEPOINT constraint_check");
            jdbc.execute("RELEASE SAVEPOINT constraint_check");
        }
    }

    @Test void crudPreservesRelations() {
        var original = service.getLocations(null);
        long max = original.stream().mapToLong(LocationDto::getId).max().orElseThrow();
        var location = LocationDto.builder().name("Kiểm thử PostgreSQL").terminal("T1").floor(0)
                .x(123.5).y(45.25).lat(10.8).lng(106.6).facilities(List.of("Wi-Fi", "Tiện ích")).build();
        location = service.addLocation(location);
        flush();
        assertTrue(location.getId() > max);
        assertEquals(mapper.valueToTree(location), mapper.valueToTree(service.getLocationById(location.getId())));
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM location_facilities WHERE location_id = ?", Integer.class, location.getId()));
        Long firstFloor = jdbc.queryForObject("SELECT floor_id FROM locations WHERE id = ?", Long.class, location.getId());
        location.setTerminal("T2");
        service.updateLocation(location.getId(), location);
        flush();
        assertNotEquals(firstFloor, jdbc.queryForObject("SELECT floor_id FROM locations WHERE id = ?", Long.class, location.getId()));
        assertEquals("T2", service.getLocationById(location.getId()).getTerminal());
        location.setFacilities(List.of("Tiện ích", "Wi-Fi"));
        service.updateLocation(location.getId(), location);
        flush();
        assertEquals(List.of("Tiện ích", "Wi-Fi"), service.getLocationById(location.getId()).getFacilities());
        location.setName("Đã cập nhật");
        location.setFacilities(List.of());
        service.updateLocation(location.getId(), location);
        flush();
        assertEquals(mapper.valueToTree(location), mapper.valueToTree(service.getLocationById(location.getId())));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM location_facilities WHERE location_id = ?", Integer.class, location.getId()));
        assertEquals(List.of(), service.getLocationById(location.getId()).getFacilities());
        location.setFacilities(null);
        service.updateLocation(location.getId(), location);
        flush();
        assertNull(service.getLocationById(location.getId()).getFacilities());
        assertTrue(service.deleteLocation(original.get(0).getId()));
        assertNull(service.getLocationById(original.get(0).getId()));
        assertNotNull(service.getLocationById(location.getId()));
        assertTrue(service.deleteLocation(location.getId()));
        assertFalse(service.deleteLocation(location.getId()));
        flush();
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM location_facilities WHERE location_id = ?", Integer.class, location.getId()));
    }
}
