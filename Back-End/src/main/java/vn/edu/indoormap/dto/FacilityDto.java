package vn.edu.indoormap.dto;

import jakarta.validation.constraints.NotBlank;

public record FacilityDto(Long id, @NotBlank String name) {}
