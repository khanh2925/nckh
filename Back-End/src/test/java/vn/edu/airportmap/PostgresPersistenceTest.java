package vn.edu.airportmap;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.airportmap.dao.LocationDao;
import vn.edu.airportmap.model.Location;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

// Opt in against a local PostgreSQL database; test CRUD rolls back automatically.
@SpringBootTest
@EnabledIfEnvironmentVariable(named="DB_INTEGRATION_TEST", matches="true")
@Transactional
class PostgresPersistenceTest {
    @Autowired LocationDao dao;
    @Autowired org.springframework.jdbc.core.JdbcTemplate jdbc;
    @Autowired ObjectMapper mapper;

    @Test void seedIncludesRelationalData() {
        assertEquals(705, dao.findAll().size());
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
        var original = dao.findAll();
        long max = original.stream().mapToLong(Location::getId).max().orElseThrow();
        var location = Location.builder().name("Kiểm thử PostgreSQL").terminal("T1").floor(0)
                .x(123.5).y(45.25).lat(10.8).lng(106.6).facilities(List.of("Wi-Fi", "Tiện ích")).build();
        dao.save(location);
        assertTrue(location.getId() > max);
        assertEquals(mapper.valueToTree(location), mapper.valueToTree(dao.findById(location.getId())));
        assertEquals(2, jdbc.queryForObject("SELECT count(*) FROM location_facilities WHERE location_id = ?", Integer.class, location.getId()));
        Long firstFloor = jdbc.queryForObject("SELECT floor_id FROM locations WHERE id = ?", Long.class, location.getId());
        location.setTerminal("T2");
        dao.save(location);
        assertNotEquals(firstFloor, jdbc.queryForObject("SELECT floor_id FROM locations WHERE id = ?", Long.class, location.getId()));
        assertEquals("T2", dao.findById(location.getId()).getTerminal());
        location.setName("Đã cập nhật");
        location.setFacilities(List.of());
        dao.save(location);
        assertEquals(mapper.valueToTree(location), mapper.valueToTree(dao.findById(location.getId())));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM location_facilities WHERE location_id = ?", Integer.class, location.getId()));
        assertEquals(List.of(), dao.findById(location.getId()).getFacilities());
        location.setFacilities(null);
        dao.save(location);
        assertNull(dao.findById(location.getId()).getFacilities());
        assertTrue(dao.deleteById(original.get(0).getId()));
        assertNull(dao.findById(original.get(0).getId()));
        assertNotNull(dao.findById(location.getId()));
        assertTrue(dao.deleteById(location.getId()));
        assertFalse(dao.deleteById(location.getId()));
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM location_facilities WHERE location_id = ?", Integer.class, location.getId()));
    }
}
