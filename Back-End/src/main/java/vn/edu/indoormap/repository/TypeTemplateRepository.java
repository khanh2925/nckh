package vn.edu.indoormap.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import vn.edu.indoormap.entity.TypeTemplate;

import java.util.List;

public interface TypeTemplateRepository extends JpaRepository<TypeTemplate, Long> {
    List<TypeTemplate> findAllByOrderByKindAscSortOrderAscNameAsc();
    List<TypeTemplate> findByKindInOrderBySortOrderAscNameAsc(List<String> kinds);
}
