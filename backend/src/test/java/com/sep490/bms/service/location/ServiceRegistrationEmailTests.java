package com.sep490.bms.service.location;

import static org.assertj.core.api.Assertions.assertThat;
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
        assertThat(message.getValue().getText()).contains("Sân Bình Minh", "Lý do: Chưa nhận được tiền thuê", "hoàn lại tiền thuê");
    }
}
