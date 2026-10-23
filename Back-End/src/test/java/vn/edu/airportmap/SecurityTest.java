package vn.edu.airportmap;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.nimbusds.jose.jwk.source.ImmutableSecret;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;
import vn.edu.airportmap.controller.AuthController;
import vn.edu.airportmap.controller.LocationController;
import vn.edu.airportmap.controller.WalkwayController;
import vn.edu.airportmap.dto.LocationDto;
import vn.edu.airportmap.security.LoginAttemptService;
import vn.edu.airportmap.security.SecurityConfig;
import vn.edu.airportmap.security.TokenService;
import vn.edu.airportmap.service.LocationService;
import vn.edu.airportmap.service.WalkwayService;

import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

// Who may read and who may write. Runs without a database: the services are mocks.
@WebMvcTest(controllers = {AuthController.class, LocationController.class, WalkwayController.class})
@Import({SecurityConfig.class, TokenService.class, LoginAttemptService.class})
@TestPropertySource(properties = {
        "app.admin.username=admin",
        "app.admin.password=correct-password",
        "app.jwt.secret=test-secret-that-is-long-enough-for-hs256",
        "app.jwt.lifetime=1h",
        "app.cors.allowed-origins=https://aeroproce.aeroproce.workers.dev"
})
class SecurityTest {
    private static final String NEW_LOCATION = """
            {"name":"Quầy thử","terminal":"T1","floor":1,"x":10,"y":20}""";

    @Autowired MockMvc mvc;
    @Autowired ObjectMapper mapper;
    @Autowired SecretKey jwtKey;
    @MockitoBean LocationService locationService;
    @MockitoBean WalkwayService walkwayService;

    // Each test uses its own address, so the wrong-login counter of one test can't block another
    private static MockHttpServletRequestBuilder from(MockHttpServletRequestBuilder request, String address) {
        return request.with(req -> {
            req.setRemoteAddr(address);
            return req;
        });
    }

    private MockHttpServletRequestBuilder login(String password, String address) {
        return from(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\":\"admin\",\"password\":\"" + password + "\"}"), address);
    }

    private String token(String address) throws Exception {
        String body = mvc.perform(login("correct-password", address)).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        return mapper.readTree(body).get("token").asText();
    }

    private String signedToken(SecretKey key, List<String> roles, Instant expiresAt) {
        JwtClaimsSet claims = JwtClaimsSet.builder().subject("admin").issuedAt(expiresAt.minusSeconds(3600)).expiresAt(expiresAt).claim("roles", roles).build();
        return new NimbusJwtEncoder(new ImmutableSecret<>(key))
                .encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();
    }

    @Test void everyoneCanRead() throws Exception {
        when(locationService.getLocations(null)).thenReturn(List.of());
        mvc.perform(get("/api/locations")).andExpect(status().isOk());
        mvc.perform(get("/api/walkways")).andExpect(status().isOk());
    }

    @Test void writingWithoutLoginIsRejected() throws Exception {
        mvc.perform(post("/api/locations").contentType(MediaType.APPLICATION_JSON).content(NEW_LOCATION)).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/locations/1").contentType(MediaType.APPLICATION_JSON).content(NEW_LOCATION)).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/locations/1")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/walkways").contentType(MediaType.APPLICATION_JSON).content("{\"nodes\":[],\"edges\":[]}")).andExpect(status().isUnauthorized());
    }

    @Test void wrongPasswordGetsNoToken() throws Exception {
        mvc.perform(login("wrong-password", "10.0.0.2")).andExpect(status().isUnauthorized());
        mvc.perform(from(post("/api/auth/login").contentType(MediaType.APPLICATION_JSON).content("{\"username\":\"admin\"}"), "10.0.0.2"))
                .andExpect(status().isBadRequest());
    }

    @Test void adminTokenCanWrite() throws Exception {
        String body = mvc.perform(login("correct-password", "10.0.0.3")).andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        JsonNode response = mapper.readTree(body);
        assertEquals("admin", response.get("username").asText());
        assertTrue(Instant.parse(response.get("expiresAt").asText()).isAfter(Instant.now()));
        String bearer = "Bearer " + response.get("token").asText();

        when(locationService.addLocation(any())).thenReturn(LocationDto.builder().id(9L).name("Quầy thử").build());
        when(locationService.deleteLocation(anyLong())).thenReturn(true);
        mvc.perform(post("/api/locations").header("Authorization", bearer).contentType(MediaType.APPLICATION_JSON).content(NEW_LOCATION))
                .andExpect(status().isOk()).andExpect(jsonPath("$.id").value(9));
        mvc.perform(delete("/api/locations/9").header("Authorization", bearer)).andExpect(status().isNoContent());
    }

    @Test void forgedExpiredOrRolelessTokensAreRejected() throws Exception {
        SecretKey otherKey = new SecretKeySpec(new byte[32], "HmacSHA256");
        String forged = signedToken(otherKey, List.of("ADMIN"), Instant.now().plusSeconds(600));
        String expired = signedToken(jwtKey, List.of("ADMIN"), Instant.now().minusSeconds(600));
        String noRole = signedToken(jwtKey, List.of(), Instant.now().plusSeconds(600));

        mvc.perform(delete("/api/locations/1").header("Authorization", "Bearer " + forged)).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/locations/1").header("Authorization", "Bearer " + expired)).andExpect(status().isUnauthorized());
        mvc.perform(delete("/api/locations/1").header("Authorization", "Bearer " + noRole)).andExpect(status().isForbidden());
        mvc.perform(delete("/api/locations/1").header("Authorization", "Bearer not-a-token")).andExpect(status().isUnauthorized());
    }

    @Test void tooManyWrongLoginsAreBlocked() throws Exception {
        for (int i = 0; i < 5; i++) {
            mvc.perform(login("wrong-password", "10.0.0.4")).andExpect(status().isUnauthorized());
        }
        // Even the right password waits now, so guessing can't continue
        mvc.perform(login("correct-password", "10.0.0.4")).andExpect(status().isTooManyRequests());
        // Other visitors are not affected
        assertFalse(token("10.0.0.5").isBlank());
    }

    @Test void websiteMayCallWithToken() throws Exception {
        mvc.perform(options("/api/locations/1")
                        .header("Origin", "https://aeroproce.aeroproce.workers.dev")
                        .header("Access-Control-Request-Method", "DELETE")
                        .header("Access-Control-Request-Headers", "authorization"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin", "https://aeroproce.aeroproce.workers.dev"));
        mvc.perform(options("/api/locations/1")
                        .header("Origin", "https://evil.example")
                        .header("Access-Control-Request-Method", "DELETE"))
                .andExpect(status().isForbidden());
    }
}
