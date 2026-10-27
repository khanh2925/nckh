package vn.edu.indoormap.service.impl;

import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.DisabledException;
import org.springframework.security.authentication.LockedException;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.AuthenticationException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vn.edu.indoormap.dto.AuthDtos.*;
import vn.edu.indoormap.entity.User;
import vn.edu.indoormap.exception.ApiException;
import vn.edu.indoormap.repository.UserRepository;
import vn.edu.indoormap.security.CurrentUser;
import vn.edu.indoormap.security.LoginAttemptService;
import vn.edu.indoormap.security.TokenService;
import vn.edu.indoormap.service.AuthService;

@Service
@Transactional
public class AuthServiceImpl implements AuthService {
    private final AuthenticationManager authenticationManager;
    private final TokenService tokenService;
    private final LoginAttemptService loginAttempts;
    private final UserRepository users;
    private final PasswordEncoder passwordEncoder;
    private final CurrentUser currentUser;

    public AuthServiceImpl(AuthenticationManager authenticationManager, TokenService tokenService,
                           LoginAttemptService loginAttempts, UserRepository users,
                           PasswordEncoder passwordEncoder, CurrentUser currentUser) {
        this.authenticationManager = authenticationManager;
        this.tokenService = tokenService;
        this.loginAttempts = loginAttempts;
        this.users = users;
        this.passwordEncoder = passwordEncoder;
        this.currentUser = currentUser;
    }

    @Override
    public LoginResponse login(LoginRequest request, String clientAddress) {
        if (loginAttempts.isBlocked(clientAddress)) {
            throw new ApiException(HttpStatus.TOO_MANY_REQUESTS, "Đăng nhập sai quá nhiều lần, hãy thử lại sau 15 phút");
        }
        String email = request.email().trim().toLowerCase();
        try {
            authenticationManager.authenticate(UsernamePasswordAuthenticationToken.unauthenticated(email, request.password()));
        } catch (DisabledException e) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Tài khoản đang chờ quản trị hệ thống duyệt");
        } catch (LockedException e) {
            throw new ApiException(HttpStatus.FORBIDDEN, "Tài khoản đã bị khoá");
        } catch (AuthenticationException e) {
            loginAttempts.recordFailure(clientAddress);
            throw new ApiException(HttpStatus.UNAUTHORIZED, "Sai email hoặc mật khẩu");
        }
        loginAttempts.reset(clientAddress);
        User user = users.findByEmailIgnoreCase(email).orElseThrow();
        TokenService.Issued issued = tokenService.issue(user);
        return new LoginResponse(issued.token(), toDto(user), issued.expiresAt());
    }

    // Tài khoản mới là chủ địa điểm ở trạng thái PENDING, quản trị hệ thống duyệt mới đăng nhập được
    @Override
    public UserDto register(RegisterRequest request) {
        String email = request.email().trim().toLowerCase();
        if (users.existsByEmailIgnoreCase(email)) {
            throw ApiException.conflict("Email này đã được đăng ký");
        }
        User user = User.builder()
                .email(email)
                .passwordHash(passwordEncoder.encode(request.password()))
                .fullName(request.fullName().trim())
                .role(User.Role.VENUE_ADMIN)
                .status(User.Status.PENDING)
                .build();
        return toDto(users.save(user));
    }

    @Override
    @Transactional(readOnly = true)
    public UserDto me() {
        return toDto(currentUser.require());
    }

    @Override
    public UserDto updateProfile(UpdateProfileRequest request) {
        User user = currentUser.require();
        user.setFullName(request.fullName().trim());
        return toDto(users.save(user));
    }

    @Override
    public void changePassword(ChangePasswordRequest request) {
        User user = currentUser.require();
        if (!passwordEncoder.matches(request.currentPassword(), user.getPasswordHash())) {
            throw ApiException.badRequest("Mật khẩu hiện tại không đúng");
        }
        user.setPasswordHash(passwordEncoder.encode(request.newPassword()));
        users.save(user);
    }

    public static UserDto toDto(User u) {
        return new UserDto(u.getId(), u.getEmail(), u.getFullName(), u.getRole().name(), u.getStatus().name(), u.getCreatedAt());
    }
}
