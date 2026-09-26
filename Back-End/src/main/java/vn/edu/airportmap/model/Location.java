package vn.edu.airportmap.model;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.*;

import java.util.List;

// NON_NULL: empty fields are not written to the JSON file, keeping it short and readable
@JsonInclude(JsonInclude.Include.NON_NULL)
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

    // Geographic coordinates from the source map, retained for accurate marker placement.
    private Double lat;
    private Double lng;
    private Long sourceId;
    private String phone;
    private String website;

    // Optional information, can be null
    private String area;
    private String description;
    private String openingHours;
    private List<String> facilities;
}
