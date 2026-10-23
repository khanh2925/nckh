package vn.edu.airportmap.controller;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.AuthenticationException;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import vn.edu.airportmap.dto.LoginRequest;
import vn.edu.airportmap.dto.LoginResponse;
import vn.edu.airportmap.security.LoginAttemptService;
import vn.edu.airportmap.security.TokenService;

@RestController
@RequestMapping("/api/auth")
public class AuthController {
    private final AuthenticationManager authenticationManager;
    private final TokenService tokenService;
    private final LoginAttemptService loginAttempts;

    public AuthController(AuthenticationManager authenticationManager, TokenService tokenService, LoginAttemptService loginAttempts) {
        this.authenticationManager = authenticationManager;
        this.tokenService = tokenService;
        this.loginAttempts = loginAttempts;
    }

    // POST /api/auth/login  { "username": "...", "password": "..." }  ->  { token, username, expiresAt }
    @PostMapping("/login")
    public LoginResponse login(@RequestBody LoginRequest request, HttpServletRequest http) {
        if (request.username() == null || request.username().isBlank() || request.password() == null || request.password().isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Thiếu tên đăng nhập hoặc mật khẩu");
        }
        // Behind Render's proxy this is the real visitor address (server.forward-headers-strategy=native)
        String client = http.getRemoteAddr();
        if (loginAttempts.isBlocked(client)) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Đăng nhập sai quá nhiều lần, hãy thử lại sau 15 phút");
        }
        try {
            Authentication authentication = authenticationManager.authenticate(
                    UsernamePasswordAuthenticationToken.unauthenticated(request.username().trim(), request.password()));
            loginAttempts.reset(client);
            return tokenService.issue(authentication);
        } catch (AuthenticationException e) {
            loginAttempts.recordFailure(client);
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Sai tên đăng nhập hoặc mật khẩu");
        }
    }
}
