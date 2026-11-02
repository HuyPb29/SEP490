package com.sep490.bms;

import static org.assertj.core.api.Assertions.*;
import com.sep490.bms.security.JwtTokenProvider;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

class JwtConfigurationTests {
    @Test
    void rejectsWeakKeysAndNonPositiveLifetime() {
        JwtTokenProvider provider = new JwtTokenProvider();
        ReflectionTestUtils.setField(provider, "jwtSecret", "short-test-key");
        ReflectionTestUtils.setField(provider, "jwtExpirationMs", 60000L);
        assertThatThrownBy(provider::init).isInstanceOf(IllegalStateException.class);
        ReflectionTestUtils.setField(provider, "jwtSecret", "test-key-for-unit-tests-at-least-32-bytes");
        ReflectionTestUtils.setField(provider, "jwtExpirationMs", 0L);
        assertThatThrownBy(provider::init).isInstanceOf(IllegalStateException.class);
        ReflectionTestUtils.setField(provider, "jwtExpirationMs", 60000L);
        assertThatCode(provider::init).doesNotThrowAnyException();
    }
}
