package vn.edu.indoormap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.edu.indoormap.entity.Building;

import java.util.List;
import java.util.Optional;

public interface BuildingRepository extends JpaRepository<Building, Long> {
    List<Building> findByVenue_IdOrderBySortOrderAscIdAsc(Long venueId);
    Optional<Building> findByIdAndVenue_Id(Long id, Long venueId);
    boolean existsByVenue_IdAndCodeIgnoreCase(Long venueId, String code);
}
