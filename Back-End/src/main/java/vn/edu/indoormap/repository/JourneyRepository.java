package vn.edu.indoormap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.edu.indoormap.entity.Journey;

import java.util.List;
import java.util.Optional;

public interface JourneyRepository extends JpaRepository<Journey, Long> {
    List<Journey> findByVenue_IdOrderBySortOrderAscIdAsc(Long venueId);
    List<Journey> findByVenue_IdAndStatusOrderBySortOrderAscIdAsc(Long venueId, Journey.Status status);
    Optional<Journey> findByIdAndVenue_Id(Long id, Long venueId);
}
