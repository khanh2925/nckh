package vn.edu.indoormap.security;

import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.stereotype.Service;
import vn.edu.indoormap.entity.User;
import vn.edu.indoormap.repository.UserRepository;

// Đọc tài khoản từ bảng users; tên đăng nhập là email
@Service
public class JpaUserDetailsService implements UserDetailsService {
    private final UserRepository users;

    public JpaUserDetailsService(UserRepository users) {
        this.users = users;
    }

    @Override
    public UserDetails loadUserByUsername(String email) throws UsernameNotFoundException {
        User user = users.findByEmailIgnoreCase(email)
                .orElseThrow(() -> new UsernameNotFoundException("Không có tài khoản " + email));
        return org.springframework.security.core.userdetails.User.withUsername(user.getEmail())
                .password(user.getPasswordHash())
                .roles(user.getRole().name())
                // PENDING: chưa được duyệt; LOCKED: bị khoá -> Spring Security từ chối với thông báo riêng
                .disabled(user.getStatus() == User.Status.PENDING)
                .accountLocked(user.getStatus() == User.Status.LOCKED)
                .build();
    }
}
