package com.sep490.bms.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import lombok.extern.slf4j.Slf4j;
import com.sep490.bms.exception.AppException;
import org.springframework.http.HttpStatus;

@Service
@Slf4j
public class EmailService {

    @Autowired(required = false)
    private JavaMailSender mailSender;

    @Value("${spring.mail.username:}")
    private String fromEmail;

    @Value("${app.mail.enabled:false}")
    private boolean mailEnabled;

    public void sendVerificationOtp(String toEmail, String otpCode) {
        String subject = "Mã xác thực đăng ký tài khoản BMS";
        String content = "Xin chào,\n\n"
                + "Cảm ơn bạn đã đăng ký tài khoản tại Hệ thống quản lý sân cầu lông BMS.\n"
                + "Mã xác thực (OTP) của bạn là: " + otpCode + "\n\n"
                + "Mã này có hiệu lực trong vòng 10 phút. Vui lòng không chia sẻ mã này với bất kỳ ai.\n\n"
                + "Trân trọng,\n"
                + "Đội ngũ quản trị BMS";
        sendEmail(toEmail, subject, content);
    }

    public void sendPasswordResetOtp(String toEmail, String otpCode) {
        String subject = "Mã xác nhận đặt lại mật khẩu BMS";
        String content = "Xin chào,\n\n"
                + "Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản BMS của bạn.\n"
                + "Mã xác nhận (OTP) của bạn là: " + otpCode + "\n\n"
                + "Mã này có hiệu lực trong vòng 10 phút. Nếu bạn không yêu cầu hành động này, vui lòng bỏ qua email.\n\n"
                + "Trân trọng,\n"
                + "Đội ngũ quản trị BMS";
        sendEmail(toEmail, subject, content);
    }

    private void sendEmail(String toEmail, String subject, String content) {
        if (!mailEnabled || mailSender == null || !StringUtils.hasText(fromEmail)) {
            throw new AppException("Dịch vụ gửi email chưa sẵn sàng. Vui lòng thử lại sau", HttpStatus.SERVICE_UNAVAILABLE);
        }
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromEmail);
            message.setTo(toEmail);
            message.setSubject(subject);
            message.setText(content);
            mailSender.send(message);
        } catch (Exception ex) {
            // Do not log the message body or provider exception, which may include the OTP.
            log.error("SMTP delivery failed ({})", ex.getClass().getSimpleName());
            throw new AppException("Không thể gửi email xác thực. Vui lòng thử lại sau", HttpStatus.SERVICE_UNAVAILABLE);
        }
    }
}
