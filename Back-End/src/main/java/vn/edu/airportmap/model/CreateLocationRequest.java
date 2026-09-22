package vn.edu.airportmap.model;

public record CreateLocationRequest(
        String name,
        String type,
        String typeName,
        double x,
        double y,
        int floor
) {}
