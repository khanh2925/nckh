package vn.edu.indoormap.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;
import vn.edu.indoormap.entity.User;
import vn.edu.indoormap.repository.UserRepository;

// Tạo tài khoản quản trị hệ thống đầu tiên từ ADMIN_EMAIL / ADMIN_PASSWORD khi bảng users chưa có ai.
// Sau đó quản lý tài khoản bằng API /api/admin/users; đổi mật khẩu bằng /api/auth/me/password.
@Configuration
public class AdminBootstrap {
    private static final Logger log = LoggerFactory.getLogger(AdminBootstrap.class);

    @Bean
    ApplicationRunner createFirstAdmin(UserRepository users, PasswordEncoder encoder,
                                       @Value("${app.admin.email}") String email,
                                       @Value("${app.admin.password}") String password) {
        return args -> {
            if (users.count() > 0) {
                return;
            }
            if (password.isBlank()) {
                log.warn("Chưa có tài khoản nào và ADMIN_PASSWORD chưa đặt: không ai đăng nhập được");
                return;
            }
            users.save(User.builder()
                    .email(email.trim().toLowerCase())
                    .passwordHash(encoder.encode(password))
                    .fullName("Quản trị hệ thống")
                    .role(User.Role.SYSTEM_ADMIN)
                    .status(User.Status.ACTIVE)
                    .build());
            log.info("Đã tạo tài khoản quản trị hệ thống {}", email);
        };
    }
}
