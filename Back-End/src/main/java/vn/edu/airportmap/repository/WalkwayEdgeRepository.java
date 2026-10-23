package vn.edu.airportmap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.edu.airportmap.entity.WalkwayEdge;
import vn.edu.airportmap.entity.WalkwayEdgeId;

import java.util.List;

public interface WalkwayEdgeRepository extends JpaRepository<WalkwayEdge, WalkwayEdgeId> {
    List<WalkwayEdge> findAllByOrderByIdFromIdAscIdToIdAsc();
}
