package vn.edu.airportmap.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.domain.Persistable;

// A straight walkable segment between two nodes, usable in both directions.
// When the two nodes are on different floors, the edge is an elevator/escalator/stairs.
@Entity
@Table(name = "walkway_edges")
@Getter
@Setter
@NoArgsConstructor
public class WalkwayEdge implements Persistable<WalkwayEdgeId> {
    // Only the ids are mapped; walkway_edges has foreign keys to walkway_nodes in the database
    @EmbeddedId
    private WalkwayEdgeId id;

    // Same reason as WalkwayNode: the key is known before insert
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
