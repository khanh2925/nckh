package vn.edu.indoormap.entity;

import jakarta.persistence.*;
import lombok.*;

// Loại địa điểm do từng venue tự định nghĩa (gate, checkin, clinic, classroom...)
@Entity
@Table(name = "location_types", uniqueConstraints = @UniqueConstraint(columnNames = {"venue_id", "code"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class LocationType {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "venue_id", nullable = false)
    private Venue venue;

    @Column(nullable = false)
    private String code;

    @Column(nullable = false)
    private String name;

    private String icon;
    private String color;

    @Column(name = "group_name")
    private String groupName;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;
}
