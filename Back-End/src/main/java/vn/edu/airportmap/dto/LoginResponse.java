package vn.edu.airportmap.dto;

import java.time.Instant;

// The front-end keeps the token and sends it as "Authorization: Bearer <token>" until expiresAt
public record LoginResponse(String token, String username, Instant expiresAt) {
}
