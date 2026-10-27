package vn.edu.indoormap.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import vn.edu.indoormap.entity.User;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

// Tạo token JWT cho một tài khoản đã xác thực
@Service
public class TokenService {
    private final JwtEncoder jwtEncoder;
    private final Duration lifetime;

    public TokenService(JwtEncoder jwtEncoder, @Value("${app.jwt.lifetime}") Duration lifetime) {
        this.jwtEncoder = jwtEncoder;
        this.lifetime = lifetime;
    }

    public record Issued(String token, Instant expiresAt) {}

    public Issued issue(User user) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(lifetime);
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("indoor-map")
                .subject(user.getEmail())
                .issuedAt(now)
                .expiresAt(expiresAt)
                .claim("uid", user.getId())
                .claim("roles", List.of(user.getRole().name()))
                .build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
        return new Issued(token, expiresAt);
    }
}
