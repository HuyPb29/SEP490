package com.sep490.bms.service.booking;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.HashSet;
import java.util.Set;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.http.HttpStatus;

import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.booking.BookingRepository;

/**
 * Mã booking dạng BK + yyMMdd + 6 ký tự dễ đọc qua điện thoại; trùng mã thì sinh lại, quá 5 lần thì báo lỗi.
 */
class BookingCodeGeneratorTests {

    private static final String READABLE = "[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}";

    private final BookingRepository bookings = mock(BookingRepository.class);
    private final BookingCodeGenerator generator = new BookingCodeGenerator(bookings);

    @Test
    void codeHasDatePrefixAndReadableRandomPart() {
        String before = prefixOf(LocalDate.now());
        String code = generator.next();
        String after = prefixOf(LocalDate.now());

        assertThat(code).hasSize(15).matches("BK\\d{6}-" + READABLE);
        assertThat(code.substring(0, 9)).isIn(before, after);
        assertThat(code.substring(9)).as("không có 0, O, 1, I, L").doesNotContainPattern("[01OIL]");
    }

    @Test
    void codesDifferBetweenCalls() {
        Set<String> codes = new HashSet<>();
        for (int i = 0; i < 50; i++) {
            codes.add(generator.next());
        }
        assertThat(codes).hasSize(50);
    }

    @Test
    void takenCodeIsReplacedByAFreshOne() {
        when(bookings.existsByBookingCode(anyString())).thenReturn(true, false);

        String code = generator.next();

        ArgumentCaptor<String> checked = ArgumentCaptor.forClass(String.class);
        verify(bookings, times(2)).existsByBookingCode(checked.capture());
        assertThat(code).isEqualTo(checked.getAllValues().get(1));
    }

    @Test
    void fiveCollisionsInARowGiveUpWith503() {
        when(bookings.existsByBookingCode(anyString())).thenReturn(true);

        assertThatThrownBy(generator::next)
                .isInstanceOf(AppException.class)
                .hasMessage("Không sinh được mã booking, vui lòng thử lại")
                .extracting(e -> ((AppException) e).getStatus()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
        verify(bookings, times(5)).existsByBookingCode(anyString());
    }

    private static String prefixOf(LocalDate date) {
        return "BK" + date.format(DateTimeFormatter.ofPattern("yyMMdd")) + "-";
    }
}
