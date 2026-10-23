package vn.edu.airportmap.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import vn.edu.airportmap.entity.WalkwayNode;

import java.util.List;

public interface WalkwayNodeRepository extends JpaRepository<WalkwayNode, String> {
    // Loads each node's floor and terminal in the same query (avoids N+1)
    @EntityGraph(attributePaths = {"floor", "floor.terminal"})
    List<WalkwayNode> findAllByOrderByIdAsc();
}
