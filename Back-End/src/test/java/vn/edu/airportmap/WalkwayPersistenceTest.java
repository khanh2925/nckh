package vn.edu.airportmap;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.airportmap.model.WalkwayEdge;
import vn.edu.airportmap.model.WalkwayNetwork;
import vn.edu.airportmap.model.WalkwayNode;
import vn.edu.airportmap.service.WalkwayService;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

// Same as PostgresPersistenceTest: needs DB_INTEGRATION_TEST=true and rolls back after each test.
@SpringBootTest
@EnabledIfEnvironmentVariable(named = "DB_INTEGRATION_TEST", matches = "true")
@Transactional
class WalkwayPersistenceTest {
    @Autowired WalkwayService walkwayService;

    @Test void saveReplacesTheWholeNetwork() {
        WalkwayNode a = WalkwayNode.builder().id("test-a").terminal("T1").floor(0).lat(10.813).lng(106.662).build();
        WalkwayNode b = WalkwayNode.builder().id("test-b").terminal("T1").floor(1).lat(10.813).lng(106.662).connector("Thang máy").build();
        List<WalkwayEdge> edges = new ArrayList<>(List.of(new WalkwayEdge("test-b", "test-a"), new WalkwayEdge("test-a", "test-b")));

        WalkwayNetwork saved = walkwayService.saveWalkways(new WalkwayNetwork(new ArrayList<>(List.of(a, b)), edges));

        assertEquals(2, saved.getNodes().size());
        assertEquals(1, saved.getEdges().size());   // A-B and B-A are the same segment
        assertEquals("Thang máy", saved.getNodes().get(1).getConnector());
        assertEquals(1, (int) saved.getNodes().get(1).getFloor());
    }

    @Test void unknownFloorIsRejected() {
        WalkwayNode node = WalkwayNode.builder().id("test-x").terminal("T9").floor(0).lat(10.8).lng(106.6).build();
        assertThrows(IllegalArgumentException.class,
                () -> walkwayService.saveWalkways(new WalkwayNetwork(new ArrayList<>(List.of(node)), new ArrayList<>())));
    }
}
