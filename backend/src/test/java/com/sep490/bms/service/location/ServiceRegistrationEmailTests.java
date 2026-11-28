package com.sep490.bms.service.location;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;
import com.sep490.bms.service.integration.EmailService;

class ServiceRegistrationEmailTests {
    @Test void msg117IncludesVenueAndExactRejectionReasonInOutgoingEmail() {
        var sender = mock(JavaMailSender.class);
        var service = new EmailService();
        ReflectionTestUtils.setField(service, "mailSender", sender);
        ReflectionTestUtils.setField(service, "fromEmail", "system@example.com");
        ReflectionTestUtils.setField(service, "mailEnabled", true);
        service.sendServiceRegistrationRejected("owner@example.com", "Sân Bình Minh", "Chưa nhận được tiền thuê");
        var message = ArgumentCaptor.forClass(SimpleMailMessage.class);
        verify(sender).send(message.capture());
        assertThat(message.getValue().getTo()).containsExactly("owner@example.com");
        assertThat(message.getValue().getSubject()).contains("chưa được duyệt");
        assertThat(message.getValue().getText()).contains("Sân Bình Minh", "Lý do: Chưa nhận được tiền thuê",
                "Nếu đã chuyển tiền", "hoàn lại tiền thuê thực nhận ngoài BMS", "không tự chuyển khoản tiền này sang hồ sơ mới",
                "tạo đơn mới", "chọn lại CCCD, giấy phép kinh doanh và chứng từ chuyển khoản", "Email và số điện thoại",
                "đăng nhập tài khoản đó");
    }

    @Test void smtpFailureIsReportedForTransactionRollback() {
        var sender = mock(JavaMailSender.class);
        var service = new EmailService();
        ReflectionTestUtils.setField(service, "mailSender", sender);
        ReflectionTestUtils.setField(service, "fromEmail", "system@example.com");
        ReflectionTestUtils.setField(service, "mailEnabled", true);
        doThrow(new org.springframework.mail.MailSendException("fixture SMTP unavailable"))
                .when(sender).send(any(SimpleMailMessage.class));
        assertThatThrownBy(() -> service.sendServiceRegistrationRejected("owner@example.com", "Sân thử", "Giấy tờ sai"))
                .isInstanceOfSatisfying(com.sep490.bms.exception.AppException.class,
                        ex -> assertThat(ex.getStatus()).isEqualTo(org.springframework.http.HttpStatus.SERVICE_UNAVAILABLE));
    }
}
