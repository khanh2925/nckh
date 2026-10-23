package vn.edu.airportmap.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.domain.Persistable;

// One point of the walkway network. Directions walk from node to node along the edges.
@Entity
@Table(name = "walkway_nodes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WalkwayNode implements Persistable<String> {
    // Text id made by the front-end (or by the seed file), e.g. "T1-0-15"
    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "floor_id", nullable = false)
    private Floor floor;

    @Column(nullable = false)
    private Double lat;

    @Column(nullable = false)
    private Double lng;

    // "Thang máy", "Thang cuốn", "Thang bộ"... when passengers change floor at this node, otherwise null
    private String connector;

    // The id is set by the client, so tell Spring Data a node is new instead of letting it SELECT before each insert
    @Transient
    @Builder.Default
    private boolean isNew = true;

    @PostLoad
    @PostPersist
    void markNotNew() {
        isNew = false;
    }
}
