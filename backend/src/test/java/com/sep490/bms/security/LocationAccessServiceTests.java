package com.sep490.bms.security;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockHttpServletRequest;

import com.sep490.bms.entity.account.Role;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.location.LocationRepository;

class LocationAccessServiceTests {
    private final LocationRepository locations = mock(LocationRepository.class);
    private final MockHttpServletRequest request = new MockHttpServletRequest();
    private final LocationAccessService service = new LocationAccessService(locations, request);
    private final UserPrincipal staff = UserPrincipal.builder().id(5L).role(Role.STAFF).locationId(1L).build();

    @Test
    void mutationLocksAssignedVenueWithoutRequiringHeader() {
        Location location = Location.builder().id(1L).build();
        when(locations.findByIdForUpdate(1L)).thenReturn(Optional.of(location));
        assertThat(service.selectedLocationForUpdate(staff)).isSameAs(location);
        verify(locations, never()).findById(anyLong());
    }

    @Test
    void readDoesNotTakeWriteLock() {
        when(locations.findById(1L)).thenReturn(Optional.of(Location.builder().id(1L).build()));
        service.selectedLocation(staff);
        verify(locations, never()).findByIdForUpdate(anyLong());
    }

    @Test
    void staffCannotLockAnotherVenue() {
        request.addHeader("X-Location-Id", "2");
        assertThatThrownBy(() -> service.selectedLocationForUpdate(staff))
                .isInstanceOfSatisfying(AppException.class, e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
        verifyNoInteractions(locations);
    }

    @Test
    void ownerMustStillOwnLockedVenue() {
        request.addHeader("X-Location-Id", "1");
        when(locations.findByIdForUpdate(1L)).thenReturn(Optional.of(Location.builder().id(1L).ownerId(9L).build()));
        UserPrincipal owner = UserPrincipal.builder().id(3L).role(Role.OWNER).build();
        assertThatThrownBy(() -> service.selectedLocationForUpdate(owner))
                .isInstanceOfSatisfying(AppException.class, e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.FORBIDDEN));
    }

    @Test
    void playerCannotLockVenue() {
        UserPrincipal player = UserPrincipal.builder().id(7L).role(Role.PLAYER).build();
        assertThatThrownBy(() -> service.selectedLocationForUpdate(player)).isInstanceOf(AppException.class);
        verifyNoInteractions(locations);
    }

    @Test
    void missingVenueReturnsNotFoundBeforePaymentIsAccessed() {
        when(locations.findByIdForUpdate(1L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.selectedLocationForUpdate(staff))
                .isInstanceOfSatisfying(AppException.class, e -> assertThat(e.getStatus()).isEqualTo(HttpStatus.NOT_FOUND));
    }
}
