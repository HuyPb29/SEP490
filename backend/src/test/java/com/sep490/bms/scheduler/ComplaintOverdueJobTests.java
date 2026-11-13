package com.sep490.bms.scheduler;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;

import com.sep490.bms.entity.enums.ComplaintStatus;
import com.sep490.bms.entity.feedback.Complaint;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.entity.notification.NotificationType;
import com.sep490.bms.repository.feedback.ComplaintRepository;
import com.sep490.bms.repository.location.LocationRepository;
import com.sep490.bms.service.booking.SlotAvailabilityService;
import com.sep490.bms.service.notification.NotificationService;

/**
 * Job P33 (D144): khiếu nại chờ Owner quá 3 giờ tính trong giờ mở cửa thì báo gấp Owner (MSG111).
 */
class ComplaintOverdueJobTests {

    private final ComplaintRepository complaints = mock(ComplaintRepository.class);
    private final LocationRepository locations = mock(LocationRepository.class);
    private final SlotAvailabilityService availability = mock(SlotAvailabilityService.class);
    private final NotificationService notifications = mock(NotificationService.class);
    private final ComplaintOverdueJob job = new ComplaintOverdueJob(complaints, locations, availability, notifications);

    private Complaint pendingComplaint(LocalDateTime forwardedAt) {
        return Complaint.builder()
                .id(3L).locationId(2L).playerId(7L).createdBy(7L)
                .complaintType("COURT_SERVICE").content("Sân dột")
                .status(ComplaintStatus.PENDING_OWNER)
                .forwardedAt(forwardedAt)
                .createdAt(LocalDateTime.now().minusHours(5))
                .build();
    }

    @Test
    void overdueComplaintTriggersUrgentOwnerNotification() {
        LocalDateTime forwardedAt = LocalDateTime.now().minusHours(4);
        when(complaints.findByStatus(ComplaintStatus.PENDING_OWNER)).thenReturn(List.of(pendingComplaint(forwardedAt)));
        when(availability.exceededOpeningTime(eq(2L), eq(forwardedAt), any(), eq(Complaint.OWNER_RESOLUTION_WAIT)))
                .thenReturn(true);
        Location location = mock(Location.class);
        when(location.getOwnerId()).thenReturn(8L);
        when(location.getName()).thenReturn("Linh Đàm");
        when(locations.findById(2L)).thenReturn(Optional.of(location));

        job.warnOverdueComplaints();

        verify(notifications).notifyOnce(eq(8L), eq(NotificationType.COMPLAINT_OVERDUE), any(),
                contains("#3"), eq("COMPLAINT"), eq(3L));
    }

    @Test
    void complaintWithinDeadlineIsLeftAlone() {
        LocalDateTime forwardedAt = LocalDateTime.now().minusHours(1);
        when(complaints.findByStatus(ComplaintStatus.PENDING_OWNER)).thenReturn(List.of(pendingComplaint(forwardedAt)));
        when(availability.exceededOpeningTime(eq(2L), eq(forwardedAt), any(), eq(Complaint.OWNER_RESOLUTION_WAIT)))
                .thenReturn(false);

        job.warnOverdueComplaints();

        verifyNoInteractions(notifications);
    }
}
