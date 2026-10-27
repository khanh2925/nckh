package vn.edu.indoormap.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.domain.Persistable;

// Đoạn đi thẳng giữa hai điểm, đi được hai chiều. Hai điểm khác tầng = thang máy / thang cuốn / thang bộ.
@Entity
@Table(name = "walkway_edges")
@Getter
@Setter
@NoArgsConstructor
public class WalkwayEdge implements Persistable<WalkwayEdgeId> {
    @EmbeddedId
    private WalkwayEdgeId id;

    @Transient
    private boolean isNew = true;

    public WalkwayEdge(String fromId, String toId) {
        this.id = new WalkwayEdgeId(fromId, toId);
    }

    @PostLoad
    @PostPersist
    void markNotNew() {
        isNew = false;
    }
}
