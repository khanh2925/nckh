package vn.edu.airportmap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.edu.airportmap.entity.Floor;

import java.util.Optional;

public interface FloorRepository extends JpaRepository<Floor, Long> {
    Optional<Floor> findByTerminal_CodeAndLevel(String terminalCode, Integer level);
}
