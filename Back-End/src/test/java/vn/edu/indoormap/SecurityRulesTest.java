package vn.edu.indoormap;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.web.servlet.MockMvc;
import vn.edu.indoormap.service.*;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

// Kiểm tra luật phân quyền của SecurityConfig, không cần database (các service được mock)
@SpringBootTest(properties = {
        "spring.autoconfigure.exclude=org.springframework.boot.autoconfigure.jdbc.DataSourceAutoConfiguration," +
                "org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration",
        "app.jwt.secret=test-secret-test-secret-test-secret-1234"})
@AutoConfigureMockMvc
class SecurityRulesTest {
    @Autowired MockMvc mvc;
    @MockBean AuthService authService;
    @MockBean VenueService venueService;
    @MockBean FloorPlanService floorPlanService;
    @MockBean CatalogService catalogService;
    @MockBean LocationService locationService;
    @MockBean WalkwayService walkwayService;
    @MockBean AdminService adminService;
    @MockBean vn.edu.indoormap.repository.UserRepository userRepository;

    @Test
    void publicReadsNeedNoLogin() throws Exception {
        mvc.perform(get("/api/venues")).andExpect(status().isOk());
        mvc.perform(get("/api/venues/tan-son-nhat/map")).andExpect(status().isOk());
    }

    @Test
    void writesNeedLogin() throws Exception {
        mvc.perform(post("/api/venues").contentType("application/json").content("{}")).andExpect(status().isUnauthorized());
        mvc.perform(put("/api/venues/1/walkways").contentType("application/json").content("{}")).andExpect(status().isUnauthorized());
        mvc.perform(get("/api/my/venues")).andExpect(status().isUnauthorized());
    }

    @Test
    void adminApiNeedsSystemAdmin() throws Exception {
        mvc.perform(get("/api/admin/users")).andExpect(status().isUnauthorized());
    }
}
