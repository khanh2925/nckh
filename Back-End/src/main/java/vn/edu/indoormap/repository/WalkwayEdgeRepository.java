package vn.edu.indoormap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vn.edu.indoormap.entity.WalkwayEdge;
import vn.edu.indoormap.entity.WalkwayEdgeId;

import java.util.List;

public interface WalkwayEdgeRepository extends JpaRepository<WalkwayEdge, WalkwayEdgeId> {
    // Đoạn của một địa điểm: điểm đầu thuộc một tầng của địa điểm đó
    @Query("select e from WalkwayEdge e where e.id.fromId in " +
           "(select n.id from WalkwayNode n where n.floor.building.venue.id = :venueId) " +
           "order by e.id.fromId, e.id.toId")
    List<WalkwayEdge> findByVenueId(@Param("venueId") Long venueId);
}
