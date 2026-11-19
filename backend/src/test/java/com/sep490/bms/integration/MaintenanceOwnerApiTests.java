package com.sep490.bms.integration;

import static org.assertj.core.api.Assertions.*;
import static org.springframework.security.test.web.servlet.setup.SecurityMockMvcConfigurers.springSecurity;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.sep490.bms.entity.account.*;
import com.sep490.bms.entity.location.*;
import com.sep490.bms.repository.account.AccountRepository;
import com.sep490.bms.repository.location.*;
import com.sep490.bms.security.JwtTokenProvider;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.context.WebApplicationContext;

/** API Owner/Staff thật với SQL; dữ liệu tự rollback, chỉ chạy khi bật cờ tích hợp. */
@SpringBootTest(properties={"bms.job.enabled=false", "app.booking-change.jobs-enabled=false", "bms.scheduler.match-sweep.enabled=false"})
@EnabledIfEnvironmentVariable(named="BMS_MAINTENANCE_INTEGRATION", matches="true")
@Transactional
class MaintenanceOwnerApiTests {
    @Autowired WebApplicationContext context;
    @Autowired AccountRepository accounts;
    @Autowired LocationRepository locations;
    @Autowired CourtRepository courts;
    @Autowired MaintenanceRepository maintenance;
    @Autowired JwtTokenProvider jwt;
    @Autowired ObjectMapper json;
    MockMvc mvc;
    Account owner, staff;
    Location location, otherLocation;
    Court court, otherCourt;

    @BeforeEach void setup() {
        mvc = MockMvcBuilders.webAppContextSetup(context).apply(springSecurity()).build();
        owner = account(Role.OWNER);
        location = venue(owner);
        otherLocation = venue(account(Role.OWNER));
        court = courts.saveAndFlush(Court.builder().locationId(location.getId()).name("Sân kiểm thử").build());
        otherCourt = courts.saveAndFlush(Court.builder().locationId(otherLocation.getId()).name("Sân khác").build());
        staff = account(Role.STAFF);
    }
    private Account account(Role role) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0,10);
        return accounts.saveAndFlush(Account.builder().username("m"+suffix).email(suffix+"@example.com")
                .phone("0"+String.format("%09d",Math.floorMod(UUID.randomUUID().getMostSignificantBits(),1_000_000_000L)))
                .passwordHash("unused").fullName("Kiểm thử bảo trì").role(role)
                .locationId(role == Role.STAFF ? location.getId() : null).status(AccountStatus.ACTIVE).build());
    }
    private Location venue(Account account) {
        return locations.saveAndFlush(Location.builder().ownerId(account.getId()).name("Kiểm thử bảo trì rollback")
                .address("Địa điểm kiểm thử bảo trì rollback").latitude(BigDecimal.valueOf(21))
                .longitude(BigDecimal.valueOf(105)).contactPhone(account.getPhone()).build());
    }
    private String token(Account a) { return "Bearer "+jwt.generateToken(a); }
    private String body(Long courtId) throws Exception {
        var start = LocalDate.now().plusDays(2).atTime(9,0);
        return json.writeValueAsString(Map.of("courtId",courtId,"startAt",start.toString(),
                "endAt",start.plusHours(1).toString(),"reason","Kiểm tra ánh sáng"));
    }
    @Test void ownerCreatesPendingRequestInSelectedVenueAndWithdrawsIt() throws Exception {
        var result = mvc.perform(post("/api/staff/maintenance-requests").header("Authorization",token(owner))
                .header("X-Location-Id",location.getId()).contentType("application/json").content(body(court.getId())))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.status").value("PENDING"))
                .andExpect(jsonPath("$.data.requestedBy").value(owner.getId())).andReturn();
        long id = json.readTree(result.getResponse().getContentAsString()).at("/data/id").asLong();
        assertThat(maintenance.findById(id).orElseThrow().getApprovedBy()).isNull();
        mvc.perform(post("/api/staff/maintenance-requests/"+id+"/cancel").header("Authorization",token(owner))
                .header("X-Location-Id",location.getId()).contentType("application/json").content("{}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.data.status").value("CANCELLED"));
        maintenance.flush();
    }
    @Test void ownerCannotCreateMaintenanceForAnotherOwnersVenueOrCourt() throws Exception {
        mvc.perform(post("/api/staff/maintenance-requests").header("Authorization",token(owner))
                .header("X-Location-Id",otherLocation.getId()).contentType("application/json").content(body(otherCourt.getId())))
                .andExpect(status().isForbidden());
        mvc.perform(post("/api/staff/maintenance-requests").header("Authorization",token(owner))
                .header("X-Location-Id",location.getId()).contentType("application/json").content(body(otherCourt.getId())))
                .andExpect(status().isForbidden());
    }
    @Test void staffStillCreatesRequestsAndOwnerCannotWithdrawStaffsRequest() throws Exception {
        var result = mvc.perform(post("/api/staff/maintenance-requests").header("Authorization",token(staff))
                .contentType("application/json").content(body(court.getId())))
                .andExpect(status().isCreated()).andExpect(jsonPath("$.data.status").value("PENDING")).andReturn();
        long id = json.readTree(result.getResponse().getContentAsString()).at("/data/id").asLong();
        mvc.perform(post("/api/staff/maintenance-requests/"+id+"/cancel").header("Authorization",token(owner))
                .header("X-Location-Id",location.getId()).contentType("application/json").content("{}"))
                .andExpect(status().isForbidden());
    }
}
