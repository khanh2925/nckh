package vn.edu.indoormap.controller;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import vn.edu.indoormap.dto.AuthDtos.*;
import vn.edu.indoormap.service.AuthService;

// Đăng ký, đăng nhập, hồ sơ cá nhân
@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthService auth;

    public AuthController(AuthService auth) {
        this.auth = auth;
    }

    // POST /api/auth/login { email, password } -> { token, user, expiresAt }
    @PostMapping("/login")
    public LoginResponse login(@Valid @RequestBody LoginRequest request, HttpServletRequest http) {
        // Sau proxy của Render đây là địa chỉ thật của khách (server.forward-headers-strategy=native)
        return auth.login(request, http.getRemoteAddr());
    }

    // POST /api/auth/register { email, password, fullName } -> tài khoản chủ địa điểm, chờ duyệt
    @PostMapping("/register")
    @ResponseStatus(HttpStatus.CREATED)
    public UserDto register(@Valid @RequestBody RegisterRequest request) {
        return auth.register(request);
    }

    @GetMapping("/me")
    public UserDto me() {
        return auth.me();
    }

    @PutMapping("/me")
    public UserDto updateProfile(@Valid @RequestBody UpdateProfileRequest request) {
        return auth.updateProfile(request);
    }

    @PutMapping("/me/password")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void changePassword(@Valid @RequestBody ChangePasswordRequest request) {
        auth.changePassword(request);
    }
}
