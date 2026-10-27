package vn.edu.indoormap.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import vn.edu.indoormap.entity.WalkwayNode;

import java.util.List;

public interface WalkwayNodeRepository extends JpaRepository<WalkwayNode, String> {
    @EntityGraph(attributePaths = {"floor", "floor.building"})
    List<WalkwayNode> findByFloor_Building_Venue_IdOrderByIdAsc(Long venueId);

    // Xoá toàn bộ điểm (và đoạn, nhờ ON DELETE CASCADE) của một địa điểm trước khi lưu mạng mới
    @Modifying
    @Query("delete from WalkwayNode n where n.floor.id in (select f.id from Floor f where f.building.venue.id = :venueId)")
    void deleteAllByVenueId(@Param("venueId") Long venueId);
}
