package vn.edu.airportmap.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import lombok.*;

import java.io.Serializable;

// Composite primary key (from_id, to_id) of walkway_edges
@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class WalkwayEdgeId implements Serializable {
    @Column(name = "from_id")
    private String fromId;

    @Column(name = "to_id")
    private String toId;
}
