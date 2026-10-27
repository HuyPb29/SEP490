package com.sep490.bms.repository.notification;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import com.sep490.bms.entity.notification.Notification;

@Repository
public interface NotificationRepository extends JpaRepository<Notification, Long> {
}
