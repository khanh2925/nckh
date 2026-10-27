package vn.edu.indoormap.entity;

import jakarta.persistence.*;
import lombok.*;
import org.springframework.data.domain.Persistable;

// Một điểm của mạng lối đi. Chỉ đường đi từ điểm này sang điểm kia theo các đoạn.
@Entity
@Table(name = "walkway_nodes")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class WalkwayNode implements Persistable<String> {
    // Id chữ do Builder đặt, ví dụ "T1-0-15". Nên có tiền tố venue để không trùng giữa các địa điểm.
    @Id
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "floor_id", nullable = false)
    private Floor floor;

    @Column(nullable = false)
    private Double lat;

    @Column(nullable = false)
    private Double lng;

    // "Thang máy", "Thang cuốn", "Thang bộ"... khi đổi tầng tại điểm này, ngược lại null
    private String connector;

    // Id do client đặt: báo cho Spring Data đây là dòng mới để khỏi SELECT trước mỗi INSERT
    @Transient
    @Builder.Default
    private boolean isNew = true;

    @PostLoad
    @PostPersist
    void markNotNew() {
        isNew = false;
    }
}
