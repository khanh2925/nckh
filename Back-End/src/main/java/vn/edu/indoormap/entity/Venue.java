package vn.edu.indoormap.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.Instant;
import java.util.List;

// Một địa điểm (sân bay, bệnh viện, trường, công viên...) do một chủ địa điểm dựng
@Entity
@Table(name = "venues")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Venue {
    public enum Status { DRAFT, PUBLISHED, HIDDEN }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // Dùng trong đường dẫn công khai: /v/tan-son-nhat
    @Column(nullable = false, unique = true)
    private String slug;

    @Column(nullable = false)
    private String name;

    // airport, hospital, school, mall, park, office, other (CHECK trong database)
    @Column(nullable = false)
    @Builder.Default
    private String kind = "other";

    private String description;

    @Column(name = "center_lat")
    private Double centerLat;

    @Column(name = "center_lng")
    private Double centerLng;

    // Vùng bao trên bản đồ nền: [[lat, lng], ...] lưu dạng JSONB
    @JdbcTypeCode(SqlTypes.JSON)
    private List<List<Double>> outline;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    @Builder.Default
    private Status status = Status.DRAFT;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "owner_id")
    private User owner;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = Instant.now();

    @PreUpdate
    void touch() {
        updatedAt = Instant.now();
    }
}
