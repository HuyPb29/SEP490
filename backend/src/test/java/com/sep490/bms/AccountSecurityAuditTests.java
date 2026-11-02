package com.sep490.bms;

import static org.assertj.core.api.Assertions.*;

import java.net.URI;
import java.net.http.*;
import java.nio.file.*;
import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.*;
import javax.crypto.SecretKey;

import com.fasterxml.jackson.databind.*;
import com.sep490.bms.dto.request.*;
import com.sep490.bms.entity.*;
import com.sep490.bms.repository.*;
import com.sep490.bms.security.*;
import com.sep490.bms.service.*;
import io.jsonwebtoken.Jwts;
import org.junit.jupiter.api.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

/** Real embedded HTTP server and committed SQL Server data, including container ERROR redispatch. */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class AccountSecurityAuditTests {
    @LocalServerPort int port;
    @Autowired AccountRepository accounts;
    @Autowired AccountAuditRepository audits;
    @Autowired LocationRepository locations;
    @Autowired OtpRequestRepository otps;
    @Autowired JwtTokenProvider jwt;
    @Autowired PasswordEncoder encoder;
    @Autowired JdbcTemplate jdbc;
    @Autowired ObjectMapper json;
    @Autowired UserService users;
    @Autowired AuthService auth;
    @Autowired AdminService admins;
    @Autowired PlatformTransactionManager transactions;
    @MockitoBean EmailService mail;

    final HttpClient client = HttpClient.newHttpClient();
    final List<Long> accountIds = new ArrayList<>();
    final List<Long> locationIds = new ArrayList<>();
    final List<String> pendingEmails = new ArrayList<>();
    Account player, other, owner, admin, staff;
    Location location;

    @BeforeAll void upgradeTestSchemaTwice() throws Exception {
        try (var c = Objects.requireNonNull(jdbc.getDataSource()).getConnection()) {
            if (!"BMS_Test".equalsIgnoreCase(c.getCatalog())) throw new IllegalStateException("Security regression requires BMS_Test");
            var sql = Files.readString(Path.of("db/migrations/20261030_account_security_audit.sql"));
            for (int pass = 0; pass < 2; pass++) {
                try {
                    for (String batch : sql.split("(?im)^GO\\s*$")) if (!batch.isBlank()) {
                        try (var statement = c.createStatement()) { statement.execute(batch); }
                    }
                } catch (Exception e) {
                    try (var statement = c.createStatement()) { statement.execute("IF @@TRANCOUNT>0 ROLLBACK TRANSACTION"); }
                    throw e;
                }
            }
        }
    }

    @BeforeEach void setup() {
        player = account(Role.PLAYER, null);
        other = account(Role.PLAYER, null);
        owner = account(Role.OWNER, null);
        admin = account(Role.ADMIN, null);
        location = location(owner);
        staff = account(Role.STAFF, location.getId());
    }

    Account account(Role role, Long locationId) {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 14);
        Account a = accounts.saveAndFlush(Account.builder().username("s" + suffix).email(role == Role.STAFF ? null : suffix + "@example.com")
                .phone("0" + String.format("%09d", Math.floorMod(UUID.randomUUID().getMostSignificantBits(), 1000000000L)))
                .fullName("Security Tester").role(role).locationId(locationId).status(AccountStatus.ACTIVE)
                .passwordHash(encoder.encode("Original123")).build());
        accountIds.add(a.getId());
        return a;
    }

    Location location(Account o) {
        Location l = locations.saveAndFlush(Location.builder().ownerId(o.getId()).name("Security test").address("Test")
                .contactPhone("0987654321").latitude(java.math.BigDecimal.ONE).longitude(java.math.BigDecimal.ONE).build());
        locationIds.add(l.getId());
        return l;
    }

    @AfterEach void cleanup() {
        for (String email : pendingEmails) jdbc.update("DELETE FROM otp_request WHERE email=?", email);
        for (Long id : accountIds) {
            jdbc.update("DELETE FROM otp_request WHERE email IN (SELECT email FROM account WHERE id=?)", id);
            jdbc.update("DELETE FROM account_audit WHERE actor_id=? OR target_account_id=?", id, id);
        }
        for (Long id : accountIds) accounts.findById(id).filter(a -> a.getRole() == Role.STAFF).ifPresent(accounts::delete);
        for (Long id : locationIds) locations.deleteById(id);
        for (Long id : accountIds) if (accounts.existsById(id)) accounts.deleteById(id);
        accountIds.clear(); locationIds.clear(); pendingEmails.clear();
    }

    Account fresh(Account a) { return accounts.findById(a.getId()).orElseThrow(); }
    String token(Account a) { return jwt.generateToken(fresh(a)); }
    HttpResponse<String> call(String method, String path, String token, String body, Long locationId) throws Exception {
        var builder = HttpRequest.newBuilder(URI.create("http://localhost:" + port + path)).timeout(java.time.Duration.ofSeconds(30));
        if (token != null) builder.header("Authorization", "Bearer " + token);
        if (locationId != null) builder.header("X-Location-Id", locationId.toString());
        builder.header("Content-Type", "application/json");
        builder.method(method, body == null ? HttpRequest.BodyPublishers.noBody() : HttpRequest.BodyPublishers.ofString(body));
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString());
    }
    HttpResponse<String> getMe(String token) throws Exception { return call("GET", "/api/users/me", token, null, null); }
    List<AccountAudit> history(Account a) {
        return audits.findAll((root, query, cb) -> cb.equal(root.get("targetAccountId"), a.getId()));
    }
    AccountAudit event(Account a, AccountAuditAction action) {
        return history(a).stream().filter(e -> e.getAction() == action).findFirst().orElseThrow();
    }

    @Test void logoutRevokesAllTokensAndRequiresAuthentication() throws Exception {
        String first = token(player), second = token(player);
        assertThat(first).isNotEqualTo(second);
        assertThat(getMe(first).statusCode()).isEqualTo(200);
        assertThat(call("POST", "/api/auth/logout", null, null, null).statusCode()).isEqualTo(401);
        assertThat(call("POST", "/api/auth/logout", first, null, null).statusCode()).isEqualTo(200);
        assertThat(getMe(first).statusCode()).isEqualTo(401);
        assertThat(getMe(second).statusCode()).isEqualTo(401);
        assertThat(call("POST", "/api/auth/logout", first, null, null).statusCode()).isEqualTo(401);
        assertThat(fresh(player).getTokenVersion()).isEqualTo(1);
        assertThat(event(player, AccountAuditAction.LOGOUT_ALL).getActorId()).isEqualTo(player.getId());
        String login = json.writeValueAsString(new LoginRequest(player.getUsername(), "Original123"));
        var response = call("POST", "/api/auth/login", null, login, null);
        assertThat(response.statusCode()).isEqualTo(200);
        assertThat(getMe(json.readTree(response.body()).at("/data/token").asText()).statusCode()).isEqualTo(200);
        assertThat(event(player, AccountAuditAction.LOGIN).getOutcome()).isEqualTo("SUCCESS");
    }

    @Test void passwordChangeRevokesTokensButRejectedChangeDoesNot() throws Exception {
        String old = token(player), another = token(player);
        assertThat(call("POST", "/api/users/me/password", old,
                "{\"currentPassword\":\"wrong\",\"newPassword\":\"Changed123\"}", null).statusCode()).isEqualTo(400);
        assertThat(fresh(player).getTokenVersion()).isZero();
        assertThat(history(player)).isEmpty();
        assertThat(call("POST", "/api/users/me/password", old,
                "{\"currentPassword\":\"Original123\",\"newPassword\":\"Changed123\"}", null).statusCode()).isEqualTo(200);
        assertThat(getMe(old).statusCode()).isEqualTo(401);
        assertThat(getMe(another).statusCode()).isEqualTo(401);
        assertThat(encoder.matches("Changed123", fresh(player).getPasswordHash())).isTrue();
        assertThat(event(player, AccountAuditAction.PASSWORD_CHANGED).getTargetAccountId()).isEqualTo(player.getId());
    }

    @Test void otpPasswordResetRevokesExistingTokensAndRecordsAudit() throws Exception {
        String old = token(player);
        otps.saveAndFlush(OtpRequest.builder().email(player.getEmail()).purpose(OtpPurpose.RESET_PASSWORD)
                .codeHash(encoder.encode("123456")).expiresAt(LocalDateTime.now().plusMinutes(5)).build());
        assertThat(call("POST", "/api/auth/reset-password", null,
                json.writeValueAsString(new ResetPasswordRequest(player.getEmail(), "123456", "ResetPass123")), null).statusCode()).isEqualTo(200);
        assertThat(getMe(old).statusCode()).isEqualTo(401);
        assertThat(fresh(player).getTokenVersion()).isEqualTo(1);
        assertThat(event(player, AccountAuditAction.PASSWORD_RESET).getActorId()).isEqualTo(player.getId());
    }

    @Test void staffPasswordAndDisableInvalidateTokensPermanently() throws Exception {
        String old = token(staff), ownerToken = token(owner);
        String base = "/api/owner/staff-members/" + staff.getId();
        assertThat(call("POST", base + "/password", ownerToken, "{\"newPassword\":\"StaffReset123\"}", location.getId()).statusCode()).isEqualTo(200);
        assertThat(getMe(old).statusCode()).isEqualTo(401);
        assertThat(event(staff, AccountAuditAction.STAFF_PASSWORD_RESET).getActorId()).isEqualTo(owner.getId());
        String beforeDisable = token(staff);
        assertThat(call("PATCH", base + "/status", ownerToken,
                "{\"status\":\"DISABLED\",\"reason\":\"Nghỉ việc\"}", location.getId()).statusCode()).isEqualTo(200);
        assertThat(call("PATCH", base + "/status", ownerToken, "{\"status\":\"ACTIVE\"}", location.getId()).statusCode()).isEqualTo(200);
        assertThat(getMe(beforeDisable).statusCode()).isEqualTo(401);
        assertThat(getMe(token(staff)).statusCode()).isEqualTo(200);
        AccountAudit changed = event(staff, AccountAuditAction.STAFF_STATUS_CHANGED);
        assertThat(changed.getPreviousStatus()).isEqualTo(AccountStatus.ACTIVE);
        assertThat(changed.getNewStatus()).isEqualTo(AccountStatus.DISABLED);
        assertThat(changed.getReason()).isEqualTo("Nghỉ việc");
    }

    @Test void adminLockUnlockPersistsReasonAndDoesNotRestoreOldTokens() throws Exception {
        String old = token(player), adminToken = token(admin);
        String path = "/api/admin/accounts/" + player.getId() + "/status";
        assertThat(call("PATCH", path, adminToken, "{\"status\":\"LOCKED\",\"reason\":\"Kiểm tra vi phạm\"}", null).statusCode()).isEqualTo(200);
        assertThat(call("PATCH", path, adminToken, "{\"status\":\"ACTIVE\",\"reason\":\"Đã kiểm tra\"}", null).statusCode()).isEqualTo(200);
        assertThat(getMe(old).statusCode()).isEqualTo(401);
        assertThat(getMe(token(player)).statusCode()).isEqualTo(200);
        AccountAudit locked = event(player, AccountAuditAction.ACCOUNT_STATUS_CHANGED);
        assertThat(locked.getActorId()).isEqualTo(admin.getId());
        assertThat(locked.getReason()).isEqualTo("Kiểm tra vi phạm");
        assertThat(locked.getCreatedAt()).isNotNull();
    }

    @Test void auditApiIsAdminOnlyFilteredPaginatedAndContainsNoCredentials() throws Exception {
        assertThat(call("PATCH", "/api/users/me", token(player), "{\"fullName\":\"Nguyễn Văn An\"}", null).statusCode()).isEqualTo(200);
        String path = "/api/admin/account-audits?targetAccountId=" + player.getId() + "&action=PROFILE_UPDATED&size=1";
        assertThat(call("GET", path, null, null, null).statusCode()).isEqualTo(401);
        for (Account a : List.of(player, owner, staff)) assertThat(call("GET", path, token(a), null, null).statusCode()).isEqualTo(403);
        var response = call("GET", path, token(admin), null, null);
        assertThat(response.statusCode()).isEqualTo(200);
        JsonNode data = json.readTree(response.body()).path("data");
        assertThat(data.path("totalElements").asInt()).isEqualTo(1);
        assertThat(data.at("/content/0/actorId").asLong()).isEqualTo(player.getId());
        assertThat(response.body()).doesNotContain("Original123", "passwordHash", "tokenVersion", "otp", "Bearer");
        assertThat(call("GET", path + "&actorId=" + other.getId(), token(admin), null, null).body()).contains("\"totalElements\":0");
        for (String query : List.of("page=-1", "size=101", "action=UNKNOWN", "targetAccountId=0")) {
            assertThat(call("GET", "/api/admin/account-audits?" + query, token(admin), null, null).statusCode()).isEqualTo(400);
        }
    }

    @Test void rollbackRestoresPasswordTokenGenerationAndAuditTogether() {
        String hash = fresh(player).getPasswordHash();
        assertThatThrownBy(() -> new TransactionTemplate(transactions).executeWithoutResult(status -> {
            users.changePassword(player.getId(), new ChangePasswordRequest("Original123", "Changed123"));
            throw new IllegalStateException("caller failed after mutation");
        })).isInstanceOf(IllegalStateException.class);
        assertThat(fresh(player).getPasswordHash()).isEqualTo(hash);
        assertThat(fresh(player).getTokenVersion()).isZero();
        assertThat(history(player)).isEmpty();
    }

    @Test void failedAuditInsertRollsBackStatusAndRevocation() {
        // Direct service invocation bypasses HTTP validation to force an audit persistence failure.
        assertThatThrownBy(() -> admins.updateAccountStatus(UserPrincipal.create(fresh(admin)), player.getId(),
                new UpdateStatusRequest("LOCKED", "x".repeat(501)))).isInstanceOf(RuntimeException.class);
        assertThat(fresh(player).getStatus()).isEqualTo(AccountStatus.ACTIVE);
        assertThat(fresh(player).getTokenVersion()).isZero();
        assertThat(history(player)).isEmpty();
    }

    @Test void verifiedRegistrationHasDurableAuditWithoutStoringPendingCredentials() throws Exception {
        String suffix = UUID.randomUUID().toString().replace("-", "").substring(0, 14);
        String email = suffix + "@example.com";
        pendingEmails.add(email);
        String passwordHash = encoder.encode("Register123");
        otps.saveAndFlush(OtpRequest.builder().email(email).purpose(OtpPurpose.REGISTER).codeHash(encoder.encode("123456"))
                .expiresAt(LocalDateTime.now().plusMinutes(5)).pendingData(json.writeValueAsString(Map.of(
                        "username", "r" + suffix, "email", email, "phone", "0" + String.format("%09d", Math.floorMod(UUID.randomUUID().getMostSignificantBits(), 1000000000L)),
                        "fullName", "Test Player", "passwordHash", passwordHash))).build());
        var result = call("POST", "/api/auth/verify-email", null,
                json.writeValueAsString(new VerifyEmailRequest(email, "123456")), null);
        assertThat(result.statusCode()).isEqualTo(200);
        Account registered = accounts.findByEmail(email).orElseThrow();
        accountIds.add(registered.getId());
        AccountAudit audit = event(registered, AccountAuditAction.REGISTER_VERIFIED);
        assertThat(audit.getActorId()).isEqualTo(registered.getId());
        assertThat(audit.getActorRole()).isEqualTo(Role.PLAYER);
        assertThat(json.writeValueAsString(audit)).doesNotContain(passwordHash, "Register123", "123456", "pendingData");
        jdbc.update("DELETE FROM otp_request WHERE email=?", email);
        accounts.delete(registered);
        assertThat(audits.findById(audit.getId())).isPresent();
    }

    @Test void staffCreationIsAuditedAndLongReasonIsRejectedBeforeMutation() throws Exception {
        String username = "a" + UUID.randomUUID().toString().replace("-", "").substring(0, 14);
        var result = call("POST", "/api/owner/staff-members", token(owner), json.writeValueAsString(
                Map.of("username", username, "fullName", "Test Staff", "password", "StaffCreate123")), location.getId());
        assertThat(result.statusCode()).isEqualTo(201);
        Account created = accounts.findByUsername(username).orElseThrow();
        accountIds.add(created.getId());
        AccountAudit audit = event(created, AccountAuditAction.STAFF_CREATED);
        assertThat(audit.getActorId()).isEqualTo(owner.getId());
        assertThat(audit.getLocationId()).isEqualTo(location.getId());
        assertThat(call("PATCH", "/api/admin/accounts/" + player.getId() + "/status", token(admin),
                json.writeValueAsString(Map.of("status", "LOCKED", "reason", "x".repeat(501))), null).statusCode()).isEqualTo(400);
        assertThat(fresh(player).getStatus()).isEqualTo(AccountStatus.ACTIVE);
        assertThat(history(player)).isEmpty();
    }

    @Test void concurrentLogoutsOnlyAdvanceOneGenerationAndStaleLogoutCannotRevokeNewLogin() throws Exception {
        UserPrincipal sameGeneration = UserPrincipal.create(fresh(player));
        CountDownLatch ready = new CountDownLatch(2), go = new CountDownLatch(1);
        var pool = Executors.newFixedThreadPool(2);
        try {
            Callable<Boolean> work = () -> {
                ready.countDown(); if (!go.await(10, TimeUnit.SECONDS)) throw new IllegalStateException("barrier timeout");
                try { auth.logout(sameGeneration); return true; }
                catch (com.sep490.bms.exception.AppException ex) { assertThat(ex.getStatus().value()).isEqualTo(401); return false; }
            };
            Future<Boolean> a = pool.submit(work), b = pool.submit(work);
            assertThat(ready.await(10, TimeUnit.SECONDS)).isTrue(); go.countDown();
            assertThat((a.get(20, TimeUnit.SECONDS) ? 1 : 0) + (b.get(20, TimeUnit.SECONDS) ? 1 : 0)).isEqualTo(1);
        } finally { go.countDown(); pool.shutdownNow(); }
        assertThat(fresh(player).getTokenVersion()).isEqualTo(1);
        assertThat(history(player)).extracting(AccountAudit::getAction).containsExactly(AccountAuditAction.LOGOUT_ALL);
        String newToken = token(player);
        assertThatThrownBy(() -> auth.logout(sameGeneration)).isInstanceOf(com.sep490.bms.exception.AppException.class);
        assertThat(getMe(newToken).statusCode()).isEqualTo(200);
    }

    @Test void legacyMalformedAndExpiredTokensAreRejectedOverHttp() throws Exception {
        SecretKey key = (SecretKey) ReflectionTestUtils.getField(jwt, "key");
        String legacy = Jwts.builder().subject(player.getId().toString()).expiration(new Date(System.currentTimeMillis() + 60000)).signWith(key).compact();
        String expired = Jwts.builder().subject(player.getId().toString()).claim("tokenVersion", 0)
                .expiration(new Date(System.currentTimeMillis() - 60000)).signWith(key).compact();
        for (String bad : List.of(legacy, expired, "invalid.token.value")) assertThat(getMe(bad).statusCode()).isEqualTo(401);
        assertThat(getMe(token(player)).statusCode()).isEqualTo(200);
    }

    @Test void mergedOwnerApisUseSelectedLocationAndCsvExportsRemainAvailableWhenLocked() throws Exception {
        Location second = location(owner);
        Location foreign = location(account(Role.OWNER, null));
        String ownerToken = token(owner);
        for (Long selected : List.of(location.getId(), second.getId())) {
            for (String path : List.of("/api/owner/booking-exports", "/api/owner/revenue-exports")) {
                var response = call("GET", path, ownerToken, null, selected);
                assertThat(response.statusCode()).as(path + ": " + response.body()).isEqualTo(200);
                assertThat(response.headers().firstValue("Content-Type").orElse("")).contains("text/csv");
                assertThat(response.body()).startsWith("\uFEFF");
                assertThat(call("GET", path, ownerToken, null, null).statusCode()).isEqualTo(400);
                assertThat(call("GET", path, ownerToken, null, foreign.getId()).statusCode()).isEqualTo(403);
            }
            for (String path : List.of("/api/owner/booking-reports", "/api/owner/revenue-reports",
                    "/api/owner/occupancy-reports", "/api/owner/reviews", "/api/owner/complaints")) {
                var response = call("GET", path, ownerToken, null, selected);
                assertThat(response.statusCode()).as(path + ": " + response.body()).isEqualTo(200);
            }
        }
        second.setStatus("LOCKED");
        locations.saveAndFlush(second);
        assertThat(call("GET", "/api/owner/booking-exports", ownerToken, null, second.getId()).statusCode()).isEqualTo(200);
        assertThat(call("GET", "/api/owner/revenue-exports", ownerToken, null, second.getId()).statusCode()).isEqualTo(200);
        assertThat(call("GET", "/api/owner/booking-reports", ownerToken, null, second.getId()).statusCode()).isEqualTo(403);
    }

    @Test void mergedPublicRoutesPreserveGuestAccessAndSpecificInputErrors() throws Exception {
        var matches = call("GET", "/api/matches", null, null, null);
        assertThat(matches.statusCode()).as(matches.body()).isEqualTo(200);
        var malformedId = call("GET", "/api/locations/abc", null, null, null);
        assertThat(malformedId.statusCode()).isEqualTo(400);
        assertThat(malformedId.body()).contains("id");
    }

    @Test void realHttpPreserves403ForWrongRoleAndForeignLocation() throws Exception {
        assertThat(call("GET", "/api/owner/locations", token(player), null, null).statusCode()).isEqualTo(403);
        assertThat(call("GET", "/api/admin/accounts", token(owner), null, null).statusCode()).isEqualTo(403);
        Account foreignOwner = account(Role.OWNER, null);
        Location foreign = location(foreignOwner);
        assertThat(call("GET", "/api/owner/staff-members", token(owner), null, foreign.getId()).statusCode()).isEqualTo(403);
        assertThat(getMe(null).statusCode()).isEqualTo(401);
    }
}
