package vn.edu.airportmap.dao.impl;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.airportmap.dao.WalkwayDao;
import vn.edu.airportmap.model.WalkwayEdge;
import vn.edu.airportmap.model.WalkwayNetwork;
import vn.edu.airportmap.model.WalkwayNode;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Repository
@Transactional
public class WalkwayPostgresDao implements WalkwayDao {
    private static final String SELECT_NODES = """
            SELECT n.id, f.terminal_code AS terminal, f.level AS floor, n.lat, n.lng, n.connector
            FROM walkway_nodes n JOIN floors f ON f.id = n.floor_id
            ORDER BY n.id
            """;

    private final JdbcTemplate jdbc;

    public WalkwayPostgresDao(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @Override
    @Transactional(readOnly = true)
    public WalkwayNetwork findAll() {
        List<WalkwayNode> nodes = jdbc.query(SELECT_NODES, (rs, row) -> WalkwayNode.builder()
                .id(rs.getString("id"))
                .terminal(rs.getString("terminal"))
                .floor(rs.getInt("floor"))
                .lat(rs.getDouble("lat"))
                .lng(rs.getDouble("lng"))
                .connector(rs.getString("connector"))
                .build());
        List<WalkwayEdge> edges = jdbc.query("SELECT from_id, to_id FROM walkway_edges ORDER BY from_id, to_id",
                (rs, row) -> new WalkwayEdge(rs.getString("from_id"), rs.getString("to_id")));
        return new WalkwayNetwork(nodes, edges);
    }

    // Runs in ONE transaction: if any row fails, the old network stays untouched
    @Override
    public void replaceAll(WalkwayNetwork network) {
        // "T1|0" -> id of that floor in the floors table
        Map<String, Long> floorIds = new HashMap<>();
        for (Map<String, Object> row : jdbc.queryForList("SELECT id, terminal_code, level FROM floors")) {
            floorIds.put(row.get("terminal_code") + "|" + row.get("level"), ((Number) row.get("id")).longValue());
        }

        List<Object[]> nodeRows = new ArrayList<>();
        for (WalkwayNode node : network.getNodes()) {
            Long floorId = floorIds.get(node.getTerminal() + "|" + node.getFloor());
            if (floorId == null) {
                throw new IllegalArgumentException("Không có tầng " + node.getFloor() + " ở nhà ga " + node.getTerminal());
            }
            nodeRows.add(new Object[]{node.getId(), floorId, node.getLat(), node.getLng(), node.getConnector()});
        }
        List<Object[]> edgeRows = network.getEdges().stream()
                .map(edge -> new Object[]{edge.getFrom(), edge.getTo()})
                .toList();

        // Deleting the nodes also deletes their edges (ON DELETE CASCADE)
        jdbc.update("DELETE FROM walkway_nodes");
        jdbc.batchUpdate("INSERT INTO walkway_nodes (id, floor_id, lat, lng, connector) VALUES (?, ?, ?, ?, ?)", nodeRows);
        jdbc.batchUpdate("INSERT INTO walkway_edges (from_id, to_id) VALUES (?, ?)", edgeRows);
    }
}
