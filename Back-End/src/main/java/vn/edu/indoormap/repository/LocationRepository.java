package vn.edu.indoormap.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import vn.edu.indoormap.entity.Location;

import java.util.List;
import java.util.Optional;

public interface LocationRepository extends JpaRepository<Location, Long> {
    @EntityGraph(attributePaths = {"type", "facilities", "floor", "floor.building"})
    List<Location> findByFloor_Building_Venue_IdOrderByIdAsc(Long venueId);

    @EntityGraph(attributePaths = {"type", "facilities", "floor", "floor.building"})
    List<Location> findByFloor_IdOrderByIdAsc(Long floorId);

    @EntityGraph(attributePaths = {"type", "facilities", "floor", "floor.building"})
    Optional<Location> findByIdAndFloor_Building_Venue_Id(Long id, Long venueId);

    long countByFloor_Building_Venue_Id(Long venueId);
}
