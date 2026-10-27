package vn.edu.indoormap.entity;

import jakarta.persistence.*;
import lombok.*;

// Loại địa điểm mẫu trong danh mục mặc định (quản trị hệ thống quản lý), sao chép sang venue mới theo loại hình
@Entity
@Table(name = "type_templates", uniqueConstraints = @UniqueConstraint(columnNames = {"kind", "code"}))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TypeTemplate {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    // "all" = mọi loại hình; hoặc airport, hospital, school, park...
    @Column(nullable = false)
    @Builder.Default
    private String kind = "all";

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
