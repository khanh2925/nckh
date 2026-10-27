package vn.edu.indoormap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.edu.indoormap.entity.LocationType;

import java.util.List;
import java.util.Optional;

public interface LocationTypeRepository extends JpaRepository<LocationType, Long> {
    List<LocationType> findByVenue_IdOrderBySortOrderAscNameAsc(Long venueId);
    Optional<LocationType> findByIdAndVenue_Id(Long id, Long venueId);
    Optional<LocationType> findByVenue_IdAndCode(Long venueId, String code);
}
