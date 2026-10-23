package vn.edu.airportmap.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "locations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Location {
    // Seeded rows keep their source ids; new rows take the next value of location_id_seq
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "location_id_gen")
    @SequenceGenerator(name = "location_id_gen", sequenceName = "location_id_seq", allocationSize = 1)
    private Long id;

    @Column(nullable = false)
    private String name;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "floor_id", nullable = false)
    private Floor floor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "type_code")
    private LocationType type;

    // Position in PIXELS on the floor-plan drawing (1598 x 682), NOT latitude/longitude
    private Double x;
    private Double y;

    // Geographic coordinates (WGS84) from the source map
    private Double lat;
    private Double lng;

    private Long sourceId;
    private String phone;
    private String website;
    private String area;
    private String description;
    private String openingHours;

    // false = facilities were never provided (API returns null), true = list is known, even if empty
    @Column(nullable = false)
    private boolean facilitiesKnown;

    // Join table location_facilities keeps the display order in its "position" column
    @ManyToMany
    @JoinTable(name = "location_facilities",
            joinColumns = @JoinColumn(name = "location_id"),
            inverseJoinColumns = @JoinColumn(name = "facility_id"))
    @OrderColumn(name = "position")
    @Builder.Default
    private List<Facility> facilities = new ArrayList<>();
}
