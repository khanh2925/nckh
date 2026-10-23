package vn.edu.airportmap.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "floors", uniqueConstraints = @UniqueConstraint(columnNames = {"terminal_code", "level"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Floor {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "terminal_code", nullable = false)
    private Terminal terminal;

    // Floor number inside a terminal, 0 = ground floor
    @Column(nullable = false)
    private Integer level;

    @Column(nullable = false)
    private String name;
}
