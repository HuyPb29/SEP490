package com.sep490.bms;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import com.sep490.bms.exception.AppException;
import com.sep490.bms.service.EmailService;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mail.MailSendException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

class EmailServiceTests {
    @Test
    void disabledMailAndSmtpFailureAreReportedAsUnavailable() {
        EmailService service = new EmailService();
        assertThatThrownBy(() -> service.sendVerificationOtp("test@example.com", "123456"))
                .isInstanceOfSatisfying(AppException.class, ex -> assertThat(ex.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE));
        JavaMailSender sender = mock(JavaMailSender.class);
        ReflectionTestUtils.setField(service, "mailEnabled", true);
        ReflectionTestUtils.setField(service, "fromEmail", "sender@example.com");
        ReflectionTestUtils.setField(service, "mailSender", sender);
        doThrow(new MailSendException("provider failed")).when(sender).send(any(SimpleMailMessage.class));
        assertThatThrownBy(() -> service.sendPasswordResetOtp("test@example.com", "123456"))
                .isInstanceOfSatisfying(AppException.class, ex -> {
                    assertThat(ex.getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
                    assertThat(ex.getMessage()).doesNotContain("provider failed", "123456");
                });
    }
}
