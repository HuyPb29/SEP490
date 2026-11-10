package com.sep490.bms.scheduler;
import java.time.LocalDate;
import java.util.*;
import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.enums.*;
import com.sep490.bms.repository.booking.BookingRepository;
import com.sep490.bms.repository.reschedule.AffectedBookingRepository;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
import static org.assertj.core.api.Assertions.*;

class BookingStatusJobTests {
    final BookingRepository bookings=mock(BookingRepository.class);
    final AffectedBookingRepository affected=mock(AffectedBookingRepository.class);
    final BookingStatusJob job=new BookingStatusJob(bookings,affected,mock(EntityManager.class));
    Booking candidate(BookingStatus lockedStatus,boolean pendingAffected) {
        Booking b=Booking.builder().id(1L).status(lockedStatus).playDate(LocalDate.now()).startMinute(0).endMinute(1440).build();
        when(bookings.findReachedStart(eq(BookingStatus.CONFIRMED),any(),anyInt())).thenReturn(List.of(b));
        when(bookings.findByIdForUpdate(1L)).thenReturn(Optional.of(b));
        when(affected.existsByBookingIdAndStatus(1L,AffectedStatus.PENDING)).thenReturn(pendingAffected);
        return b;
    }
    @Test void pendingAffectedNeverBecomesInUseEvenIfItAppearsInTheScan() {
        Booking b=candidate(BookingStatus.CONFIRMED,true);job.advanceBookingStatus();
        assertThat(b.getStatus()).isEqualTo(BookingStatus.CONFIRMED);verify(bookings,never()).save(any());
    }
    @Test void cancelledAfterScanIsNotOverwrittenByTheJob() {
        Booking b=candidate(BookingStatus.CANCELLED_BY_FACILITY,false);job.advanceBookingStatus();
        assertThat(b.getStatus()).isEqualTo(BookingStatus.CANCELLED_BY_FACILITY);verify(bookings,never()).save(any());
    }
    @Test void ordinaryConfirmedBookingStillStarts() {
        Booking b=candidate(BookingStatus.CONFIRMED,false);job.advanceBookingStatus();assertThat(b.getStatus()).isEqualTo(BookingStatus.IN_USE);
    }
}
