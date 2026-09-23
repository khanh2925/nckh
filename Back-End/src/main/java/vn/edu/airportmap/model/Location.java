package vn.edu.airportmap.model;

import lombok.*;

import java.util.List;

@Setter
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
@ToString
public class Location {
    private Long id;
    private String name;

    // Type key, e.g. "gate", "restroom". Labels and icons for each type live in the front-end
    private String type;

    private String terminal;
    private Integer floor;

    // Position in PIXELS on the floor-plan drawing (1598 x 682), NOT latitude/longitude
    private Double x;
    private Double y;

    // Optional information, can be null
    private String area;
    private String description;
    private String openingHours;
    private List<String> facilities;
}
