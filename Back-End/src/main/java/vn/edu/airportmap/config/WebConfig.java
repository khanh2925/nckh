package vn.edu.airportmap.config;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import java.util.Arrays;
import java.util.Set;

@Configuration
public class WebConfig implements WebMvcConfigurer {
    private static final Set<String> READ_METHODS = Set.of("GET", "HEAD", "OPTIONS");

    private final String[] allowedOrigins;
    private final boolean readOnly;

    public WebConfig(@Value("${app.cors.allowed-origins}") String origins, @Value("${app.read-only:false}") boolean readOnly) {
        allowedOrigins = Arrays.stream(origins.split(","))
                .map(String::trim).filter(value -> !value.isEmpty()).toArray(String[]::new);
        this.readOnly = readOnly;
    }

    @Override
    public void addCorsMappings(CorsRegistry registry) {
        registry.addMapping("/api/**").allowedOrigins(allowedOrigins)
                .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS");
    }

    // READ_ONLY=true (public server): the API has no login, so only reading is allowed there.
    // Add / edit / delete answer 403; data is edited in the Neon console or with the local Admin.
    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        if (!readOnly) {
            return;
        }
        registry.addInterceptor(new HandlerInterceptor() {
            @Override
            public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
                if (READ_METHODS.contains(request.getMethod())) {
                    return true;
                }
                response.sendError(HttpServletResponse.SC_FORBIDDEN, "Máy chủ này chỉ cho phép đọc dữ liệu");
                return false;
            }
        }).addPathPatterns("/api/**");
    }
}
