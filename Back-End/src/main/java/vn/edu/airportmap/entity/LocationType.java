package vn.edu.airportmap.entity;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "location_types")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class LocationType {
    // Type key, e.g. "gate", "restroom". Labels and icons live in the front-end
    @Id
    private String code;

    @Column(nullable = false)
    private String name;
}
