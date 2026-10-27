package vn.edu.indoormap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.edu.indoormap.entity.Floor;

import java.util.List;
import java.util.Optional;

public interface FloorRepository extends JpaRepository<Floor, Long> {
    List<Floor> findByBuilding_Venue_IdOrderByBuilding_SortOrderAscLevelAsc(Long venueId);
    Optional<Floor> findByIdAndBuilding_Venue_Id(Long id, Long venueId);
    boolean existsByBuilding_IdAndLevel(Long buildingId, Integer level);
}
