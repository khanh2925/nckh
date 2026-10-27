package vn.edu.indoormap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.edu.indoormap.entity.Zone;

import java.util.List;
import java.util.Optional;

public interface ZoneRepository extends JpaRepository<Zone, Long> {
    List<Zone> findByFloor_Building_Venue_IdOrderBySortOrderAscIdAsc(Long venueId);
    Optional<Zone> findByIdAndFloor_Building_Venue_Id(Long id, Long venueId);
}
