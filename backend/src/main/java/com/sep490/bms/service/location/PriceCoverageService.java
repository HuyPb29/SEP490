package com.sep490.bms.service.location;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import com.sep490.bms.common.MinuteTime;
import com.sep490.bms.entity.location.Court;
import com.sep490.bms.entity.location.Location;
import com.sep490.bms.entity.location.OpeningException;
import com.sep490.bms.entity.location.OpeningHour;
import com.sep490.bms.entity.location.PriceRule;
import com.sep490.bms.exception.AppException;
import com.sep490.bms.repository.location.CourtRepository;
import com.sep490.bms.repository.location.OpeningExceptionRepository;
import com.sep490.bms.repository.location.OpeningHourRepository;
import com.sep490.bms.repository.location.PriceRuleRepository;
import com.sep490.bms.service.booking.PackageService;

import lombok.RequiredArgsConstructor;

@Service
@RequiredArgsConstructor
public class PriceCoverageService {

    private final CourtRepository courts;
    private final OpeningHourRepository hours;
    private final OpeningExceptionRepository exceptions;
    private final PriceRuleRepository prices;
    private final com.sep490.bms.repository.location.ServiceTermRepository terms;

    public void requireCourtCoverage(Location location, Court court) {
        requireCoverage(location, List.of(court));
    }

    public void requireActiveCourtCoverage(Location location) {
        requireCoverage(location, courts.findAllByLocationIdOrderByNameAsc(location.getId()).stream()
                .filter(Court::isActive).toList());
    }

    private void requireCoverage(Location location, Collection<Court> courtsToCheck) {
        if (courtsToCheck.isEmpty()) {
            return;
        }
        Map<Integer, OpeningHour> weeklyHours = hours.findAllByLocationIdOrderByDayOfWeekAsc(location.getId())
                .stream().collect(Collectors.toMap(OpeningHour::getDayOfWeek, Function.identity()));
        Map<LocalDate, OpeningException> specialHours = exceptions
                .findAllByLocationIdOrderByExceptionDateAsc(location.getId()).stream()
                .collect(Collectors.toMap(OpeningException::getExceptionDate, Function.identity()));
        LocalDate today = LocalDate.now();
        LocalDate lastBookableDay = today.plusDays(location.getAdvanceBookingDays());
        // D175: kiểm giá tới ngày xa nhất đặt được buổi của gói (1 năm, không quá hạn dịch vụ của địa điểm)
        LocalDate lastPackageDay = PackageService.lastBookablePackageDate(today,
                terms.findFirstByLocationIdOrderByEndDateDescIdDesc(location.getId())
                        .map(com.sep490.bms.entity.location.ServiceTerm::getEndDate).orElse(null));
        if (lastPackageDay.isAfter(lastBookableDay)) {
            lastBookableDay = lastPackageDay;
        }
        List<LocalDate> dates = today.datesUntil(lastBookableDay.plusDays(1)).toList();
        var serviceTerms = courtsToCheck.stream().anyMatch(c -> c.getAvailableUntil() != null)
                ? terms.findAllByLocationId(location.getId()) : List.<com.sep490.bms.entity.location.ServiceTerm>of();
        for (Court court : courtsToCheck) {
            List<PriceRule> rules = prices.findAllByCourtIdOrderByStartMinuteAsc(court.getId());
            for (LocalDate date : dates) {
                if (court.getAvailableFrom() != null && date.isBefore(court.getAvailableFrom())) continue;
                if (court.getAvailableUntil() != null && date.isAfter(court.getAvailableUntil())
                        && serviceTerms.stream().noneMatch(t -> !date.isBefore(t.getStartDate()) && !date.isAfter(t.getEndDate()))) continue;
                int weekday = date.getDayOfWeek().getValue();
                OpeningException exception = specialHours.get(date);
                OpeningHour regular = weeklyHours.get(weekday);
                if (exception != null) {
                    requireRange(court, rules, date, exception.getOpenMinute(), exception.getCloseMinute());
                } else if (regular != null) {
                    requireRange(court, rules, date, regular.getOpenMinute(), regular.getCloseMinute());
                }
            }
        }
    }

    private void requireRange(Court court, List<PriceRule> rules, LocalDate date, int open, int close) {
        int dayIndex = date.getDayOfWeek().getValue() - 1;
        List<PriceRule> applicable = rules.stream()
                .filter(rule -> rule.getApplyDays().charAt(dayIndex) == '1'
                        && !date.isBefore(rule.getValidFrom())
                        && (rule.getValidTo() == null || !date.isAfter(rule.getValidTo())))
                .toList();
        int coveredUntil = open;
        for (PriceRule rule : applicable) {
            if (rule.getStartMinute() > coveredUntil) {
                break;
            }
            coveredUntil = Math.max(coveredUntil, rule.getEndMinute());
            if (coveredUntil >= close) {
                return;
            }
        }
        if (coveredUntil < close) {
            int gapStart = coveredUntil;
            int gapEnd = applicable.stream().mapToInt(PriceRule::getStartMinute)
                    .filter(start -> start > gapStart).findFirst().orElse(close);
            throw new AppException("Sân " + court.getName() + " chưa có giá ngày " + date
                    + ", khung " + MinuteTime.format(gapStart) + "–"
                    + MinuteTime.format(Math.min(close, gapEnd)) + ". (MSG42)", HttpStatus.CONFLICT);
        }
    }
}
