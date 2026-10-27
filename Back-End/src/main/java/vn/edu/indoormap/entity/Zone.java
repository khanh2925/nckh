package vn.edu.indoormap.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.util.List;

// Vùng chức năng trên mặt bằng (khu check-in, khoa khám bệnh...), polygon theo pixel bản vẽ
@Entity
@Table(name = "zones")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Zone {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "floor_id", nullable = false)
    private Floor floor;

    @Column(nullable = false)
    private String name;

    private String color;

    // [[x, y], ...] pixel trên bản vẽ của tầng
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(nullable = false)
    private List<List<Double>> polygon;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private Integer sortOrder = 0;
}
