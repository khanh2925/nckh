package vn.edu.indoormap.entity;

import jakarta.persistence.*;
import lombok.*;

// Tiện ích gắn cho địa điểm (Wi-Fi, ổ cắm, xe lăn...), riêng từng venue
@Entity
@Table(name = "facilities", uniqueConstraints = @UniqueConstraint(columnNames = {"venue_id", "name"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Facility {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "venue_id", nullable = false)
    private Venue venue;

    @Column(nullable = false)
    private String name;
}
