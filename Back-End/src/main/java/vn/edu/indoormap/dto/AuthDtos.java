package vn.edu.indoormap.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.Instant;

// Các DTO của /api/auth
public final class AuthDtos {
    private AuthDtos() {}

    public record LoginRequest(@NotBlank String email, @NotBlank String password) {}

    public record RegisterRequest(@NotBlank @Email String email,
                                  @NotBlank @Size(min = 8, max = 100) String password,
                                  @NotBlank @Size(max = 120) String fullName) {}

    public record ChangePasswordRequest(@NotBlank String currentPassword,
                                        @NotBlank @Size(min = 8, max = 100) String newPassword) {}

    public record UpdateProfileRequest(@NotBlank @Size(max = 120) String fullName) {}

    public record LoginResponse(String token, UserDto user, Instant expiresAt) {}

    public record UserDto(Long id, String email, String fullName, String role, String status, Instant createdAt) {}
}
