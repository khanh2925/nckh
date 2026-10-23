package vn.edu.airportmap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.edu.airportmap.entity.LocationType;

public interface LocationTypeRepository extends JpaRepository<LocationType, String> {
}
