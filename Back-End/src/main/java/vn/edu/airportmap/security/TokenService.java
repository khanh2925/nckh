package vn.edu.airportmap.security;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.stereotype.Service;
import vn.edu.airportmap.dto.LoginResponse;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

// Makes the signed token returned by POST /api/auth/login
@Service
public class TokenService {
    private final JwtEncoder jwtEncoder;
    private final Duration lifetime;

    public TokenService(JwtEncoder jwtEncoder, @Value("${app.jwt.lifetime}") Duration lifetime) {
        this.jwtEncoder = jwtEncoder;
        this.lifetime = lifetime;
    }

    public LoginResponse issue(Authentication authentication) {
        Instant now = Instant.now();
        Instant expiresAt = now.plus(lifetime);
        // "ROLE_ADMIN" -> "ADMIN"; SecurityConfig adds the prefix back when reading the token
        List<String> roles = authentication.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .map(authority -> authority.replaceFirst("^ROLE_", ""))
                .toList();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer("airport-map")
                .subject(authentication.getName())
                .issuedAt(now)
                .expiresAt(expiresAt)
                .claim("roles", roles)
                .build();
        String token = jwtEncoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
        return new LoginResponse(token, authentication.getName(), expiresAt);
    }
}
