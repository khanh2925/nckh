package vn.edu.indoormap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.edu.indoormap.entity.User;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmailIgnoreCase(String email);
    boolean existsByEmailIgnoreCase(String email);
    List<User> findAllByOrderByCreatedAtDesc();
    List<User> findByStatusOrderByCreatedAtDesc(User.Status status);
}
