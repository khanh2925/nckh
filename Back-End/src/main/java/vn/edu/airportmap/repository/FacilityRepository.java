package vn.edu.airportmap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.edu.airportmap.entity.Facility;

import java.util.Optional;

public interface FacilityRepository extends JpaRepository<Facility, Long> {
    Optional<Facility> findByName(String name);
}
