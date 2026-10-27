package vn.edu.indoormap.entity;

import jakarta.persistence.*;
import lombok.*;

// Một tầng của toà nhà: bản vẽ mặt bằng + tham số căn chỉnh pixel <-> lat/lng
@Entity
@Table(name = "floors", uniqueConstraints = @UniqueConstraint(columnNames = {"building_id", "level"}))
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
    @JoinColumn(name = "building_id", nullable = false)
    private Building building;

    // Số tầng, 0 = tầng trệt
    @Column(nullable = false)
    private Integer level;

    @Column(nullable = false)
    private String name;

    // Nội dung SVG của mặt bằng (phần bên trong <svg>) hoặc URL ảnh
    @Column(name = "plan_svg")
    private String planSvg;

    @Column(name = "plan_image_url")
    private String planImageUrl;

    @Column(name = "plan_width")
    private Double planWidth;

    @Column(name = "plan_height")
    private Double planHeight;

    // Điểm mốc 1: pixel (anchorX, anchorY) ứng với (anchorLat, anchorLng); điểm mốc 2: end*
    @Column(name = "anchor_x") private Double anchorX;
    @Column(name = "anchor_y") private Double anchorY;
    @Column(name = "anchor_lat") private Double anchorLat;
    @Column(name = "anchor_lng") private Double anchorLng;
    @Column(name = "end_x") private Double endX;
    @Column(name = "end_y") private Double endY;
    @Column(name = "end_lat") private Double endLat;
    @Column(name = "end_lng") private Double endLng;

    // Hệ số co giãn theo chiều sâu của bản vẽ (1 = không co giãn)
    @Column(name = "depth_scale", nullable = false)
    @Builder.Default
    private Double depthScale = 1.0;
}
