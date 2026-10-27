package vn.edu.indoormap.security;

import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;
import vn.edu.indoormap.entity.User;
import vn.edu.indoormap.exception.ApiException;
import vn.edu.indoormap.repository.UserRepository;

import java.util.Optional;

// Lấy tài khoản đang đăng nhập từ token của request hiện tại
@Component
public class CurrentUser {
    private final UserRepository users;

    public CurrentUser(UserRepository users) {
        this.users = users;
    }

    public Optional<User> get() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !(auth.getPrincipal() instanceof Jwt jwt)) {
            return Optional.empty();
        }
        return users.findByEmailIgnoreCase(jwt.getSubject());
    }

    public User require() {
        return get().orElseThrow(() -> new ApiException(org.springframework.http.HttpStatus.UNAUTHORIZED, "Bạn cần đăng nhập"));
    }

    public boolean isSystemAdmin() {
        return get().map(u -> u.getRole() == User.Role.SYSTEM_ADMIN).orElse(false);
    }
}
