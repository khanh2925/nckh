package vn.edu.indoormap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.edu.indoormap.entity.Facility;

import java.util.List;
import java.util.Optional;

public interface FacilityRepository extends JpaRepository<Facility, Long> {
    List<Facility> findByVenue_IdOrderByNameAsc(Long venueId);
    Optional<Facility> findByVenue_IdAndNameIgnoreCase(Long venueId, String name);
    Optional<Facility> findByIdAndVenue_Id(Long id, Long venueId);
}
