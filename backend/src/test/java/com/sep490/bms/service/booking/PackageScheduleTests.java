package com.sep490.bms.service.booking;
import java.time.LocalDate;
import java.util.List;
import java.math.BigDecimal;
import org.junit.jupiter.api.Test;
import com.sep490.bms.dto.request.PackageBookingRequest;
import com.sep490.bms.dto.request.PackageBookingRequest.*;
import com.sep490.bms.entity.enums.PackageType;
import static org.assertj.core.api.Assertions.*;

class PackageScheduleTests {
    private final LocalDate start=LocalDate.of(2027,1,1);
    private PackageBookingRequest recurring(List<Replacement> changes) {
        return new PackageBookingRequest(1L,PackageType.RECURRING,start,start.plusMonths(1).minusDays(1),null,
                List.of(new Pattern(5,600,660)),null,changes,null,null,0,null);
    }
    @Test void recurringPatternExpandsEveryWeekWithinPeriod() { assertThat(PackageBookingService.expand(recurring(null))).hasSize(5); }
    @Test void conflictingSessionCanMoveToDifferentTimeOrBeDropped() {
        var request=recurring(List.of(new Replacement(new Slot(1L,start,600,660),new Slot(1L,start.plusDays(1),900,960)),
                new Replacement(new Slot(1L,start.plusWeeks(1),600,660),null)));
        var result=PackageBookingService.expand(request);assertThat(result).hasSize(4).contains(new Slot(1L,start.plusDays(1),900,960));
    }
    @Test void replacingNonexistentSessionDoesNotSilentlyAddBookings() {
        assertThatThrownBy(()->PackageBookingService.expand(recurring(List.of(new Replacement(new Slot(1L,start,700,760),null))))).hasMessageContaining("không có");
    }
    @Test void customDeduplicatesAndStillRequiresTwoSessions() {
        var one=new Slot(1L,start,600,660);
        var r=new PackageBookingRequest(1L,PackageType.CUSTOM,start,start.plusDays(1),null,null,List.of(one,one),null,null,null,0,null);
        assertThatThrownBy(()->PackageBookingService.expand(r)).hasMessageContaining("2 buổi");
    }
    @Test void rejectsOverlappingSessionsAndKeepsAdjacentOnes() {
        var r=new PackageBookingRequest(1L,PackageType.CUSTOM,start,start.plusDays(1),null,null,
                List.of(new Slot(1L,start,600,660),new Slot(1L,start,630,690)),null,null,null,0,null);
        assertThatThrownBy(()->PackageBookingService.expand(r)).hasMessageContaining("chồng nhau");
    }
    @Test void roundingAllocatesEveryVndWithoutLosingDiscount() {
        BigDecimal total=new BigDecimal("300"),discount=new BigDecimal("100"),weight=new BigDecimal("100");
        BigDecimal a=PackageBookingService.allocation(discount,BigDecimal.ZERO,weight,total);
        BigDecimal b=PackageBookingService.allocation(discount,weight,weight,total);
        BigDecimal c=PackageBookingService.allocation(discount,weight.add(weight),weight,total);
        assertThat(a.add(b).add(c)).isEqualByComparingTo(discount);
    }
}
