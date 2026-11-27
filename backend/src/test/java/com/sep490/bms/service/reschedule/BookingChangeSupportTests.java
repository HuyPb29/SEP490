package com.sep490.bms.service.reschedule;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.List;

import org.junit.jupiter.api.Test;

import com.sep490.bms.entity.booking.Booking;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.service.team.MatchService;

import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import jakarta.persistence.TypedQuery;

class BookingChangeSupportTests {
    private final EntityManager em = mock(EntityManager.class);
    private final BookingChangeSupport support = new BookingChangeSupport(em, mock(MatchService.class));

    @Test
    @SuppressWarnings("unchecked")
    void venueIsLockedBeforeBookingAndBothAreRefreshed() {
        TypedQuery<Long> query = mock(TypedQuery.class, RETURNS_SELF);
        when(em.createQuery(anyString(), eq(Long.class))).thenReturn(query);
        when(query.getResultList()).thenReturn(List.of(1L));
        Location venue = Location.builder().id(1L).build();
        Booking booking = Booking.builder().id(2L).locationId(1L).build();
        when(em.find(Location.class, 1L, LockModeType.PESSIMISTIC_WRITE)).thenReturn(venue);
        when(em.find(Booking.class, 2L, LockModeType.PESSIMISTIC_WRITE)).thenReturn(booking);
        assertThat(support.booking(2L)).isSameAs(booking);
        var order = inOrder(em);
        order.verify(em).find(Location.class, 1L, LockModeType.PESSIMISTIC_WRITE);
        order.verify(em).refresh(venue, LockModeType.PESSIMISTIC_WRITE);
        order.verify(em).find(Booking.class, 2L, LockModeType.PESSIMISTIC_WRITE);
        order.verify(em).refresh(booking, LockModeType.PESSIMISTIC_WRITE);
    }

    @Test
    @SuppressWarnings("unchecked")
    void missingBookingTakesNoEntityLocks() {
        TypedQuery<Long> query = mock(TypedQuery.class, RETURNS_SELF);
        when(em.createQuery(anyString(), eq(Long.class))).thenReturn(query);
        when(query.getResultList()).thenReturn(List.of());
        assertThatThrownBy(() -> support.booking(2L)).isInstanceOf(AppException.class);
        verify(em, never()).find(any(), any(), any(LockModeType.class));
    }
}
