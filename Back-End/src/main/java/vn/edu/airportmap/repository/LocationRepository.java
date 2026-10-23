package vn.edu.airportmap.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import vn.edu.airportmap.entity.Location;

import java.util.List;
import java.util.Optional;

public interface LocationRepository extends JpaRepository<Location, Long> {
    // Each query loads floor, terminal, type and facilities together, avoiding one extra query per location (N+1)
    @EntityGraph(attributePaths = {"floor", "floor.terminal", "type", "facilities"})
    List<Location> findAllByOrderByIdAsc();

    // Filters by floor level across all terminals, e.g. ?floor=1
    @EntityGraph(attributePaths = {"floor", "floor.terminal", "type", "facilities"})
    List<Location> findByFloor_LevelOrderByIdAsc(Integer level);

    @EntityGraph(attributePaths = {"floor", "floor.terminal", "type", "facilities"})
    Optional<Location> findWithDetailsById(Long id);
}
