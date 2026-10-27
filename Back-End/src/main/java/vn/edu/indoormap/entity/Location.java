package vn.edu.indoormap.entity;

import jakarta.persistence.*;
import lombok.*;

import java.util.ArrayList;
import java.util.List;

// Điểm quan tâm (POI) trên một tầng
@Entity
@Table(name = "locations")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Location {
    // Dữ liệu seed giữ id gốc; dòng mới lấy giá trị kế tiếp của location_id_seq
    @Id
    @GeneratedValue(strategy = GenerationType.SEQUENCE, generator = "location_id_gen")
    @SequenceGenerator(name = "location_id_gen", sequenceName = "location_id_seq", allocationSize = 1)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "floor_id", nullable = false)
    private Floor floor;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "type_id")
    private LocationType type;

    @Column(nullable = false)
    private String name;

    // Pixel trên bản vẽ mặt bằng của tầng, KHÔNG phải kinh/vĩ độ
    private Double x;
    private Double y;

    // WGS84
    private Double lat;
    private Double lng;

    private String phone;
    private String website;
    private String area;
    private String description;

    @Column(name = "opening_hours")
    private String openingHours;

    @Column(name = "image_url")
    private String imageUrl;

    @Column(name = "source_id")
    private Long sourceId;

    // false = chưa từng nhập tiện ích (API trả null), true = danh sách đã biết, kể cả rỗng
    @Column(name = "facilities_known", nullable = false)
    private boolean facilitiesKnown;

    @ManyToMany
    @JoinTable(name = "location_facilities",
            joinColumns = @JoinColumn(name = "location_id"),
            inverseJoinColumns = @JoinColumn(name = "facility_id"))
    @OrderColumn(name = "position")
    @Builder.Default
    private List<Facility> facilities = new ArrayList<>();
}
