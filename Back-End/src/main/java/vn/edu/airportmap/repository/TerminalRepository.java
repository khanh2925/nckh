package vn.edu.airportmap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.edu.airportmap.entity.Terminal;

public interface TerminalRepository extends JpaRepository<Terminal, String> {
}
