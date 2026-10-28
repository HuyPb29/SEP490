package com.sep490.bms.service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import lombok.extern.slf4j.Slf4j;

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
        sendEmail(toEmail, subject, content, otpCode);
    }

    public void sendPasswordResetOtp(String toEmail, String otpCode) {
        String subject = "Mã xác nhận đặt lại mật khẩu BMS";
        String content = "Xin chào,\n\n"
                + "Chúng tôi nhận được yêu cầu đặt lại mật khẩu cho tài khoản BMS của bạn.\n"
                + "Mã xác nhận (OTP) của bạn là: " + otpCode + "\n\n"
                + "Mã này có hiệu lực trong vòng 10 phút. Nếu bạn không yêu cầu hành động này, vui lòng bỏ qua email.\n\n"
                + "Trân trọng,\n"
                + "Đội ngũ quản trị BMS";
        sendEmail(toEmail, subject, content, otpCode);
    }

    private void sendEmail(String toEmail, String subject, String content, String otpCode) {
        // Luôn ghi log mã OTP ra console để phục vụ môi trường Dev/Test thuận tiện
        log.info("==================================================================");
        log.info("[OTP SERVICE] To: {}", toEmail);
        log.info("[OTP SERVICE] Subject: {}", subject);
        log.info("[OTP SERVICE] OTP Code: {}", otpCode);
        log.info("==================================================================");

        if (mailEnabled && mailSender != null && StringUtils.hasText(fromEmail)) {
            try {
                SimpleMailMessage message = new SimpleMailMessage();
                message.setFrom(fromEmail);
                message.setTo(toEmail);
                message.setSubject(subject);
                message.setText(content);
                mailSender.send(message);
                log.info("[EMAIL SERVICE] Đã gửi email thành công tới {}", toEmail);
            } catch (Exception e) {
                log.error("[EMAIL SERVICE] Lỗi khi gửi email qua SMTP tới {}: {}", toEmail, e.getMessage());
            }
        } else {
            log.info("[EMAIL SERVICE] Gửi email qua SMTP đang tắt (app.mail.enabled=false hoặc chưa cấu hình mail). Dùng mã OTP trong log để kiểm thử.");
        }
    }
}
