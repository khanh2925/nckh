package vn.edu.airportmap.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "terminals")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class Terminal {
    // Natural key such as "T1", "T2"
    @Id
    private String code;

    @Column(nullable = false)
    private String name;
}
