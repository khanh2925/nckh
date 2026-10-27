package vn.edu.indoormap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.edu.indoormap.entity.Venue;

import java.util.List;
import java.util.Optional;

public interface VenueRepository extends JpaRepository<Venue, Long> {
    Optional<Venue> findBySlug(String slug);
    boolean existsBySlug(String slug);
    List<Venue> findByStatusOrderByNameAsc(Venue.Status status);
    List<Venue> findByOwner_IdOrderByUpdatedAtDesc(Long ownerId);
    List<Venue> findAllByOrderByUpdatedAtDesc();
}
