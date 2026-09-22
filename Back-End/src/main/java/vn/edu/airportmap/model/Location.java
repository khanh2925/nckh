package vn.edu.airportmap.model;

public record Location(
        long id,
        String name,
        String type,
        String typeName,
        double x,
        double y,
        int floor
) {}
