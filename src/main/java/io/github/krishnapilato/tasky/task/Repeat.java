package io.github.krishnapilato.tasky.task;

import module java.base;

public enum Repeat {
    NONE, DAILY, WEEKDAYS, WEEKLY, MONTHLY;

    public Optional<LocalDate> next(LocalDate due, LocalDate today) {
        if (this == NONE) return Optional.empty();
        var date = Objects.requireNonNullElse(due, today);
        do date = step(date); while (!date.isAfter(today));
        return Optional.of(date);
    }

    private LocalDate step(LocalDate date) {
        return switch (this) {
            case NONE -> date;
            case DAILY -> date.plusDays(1);
            case WEEKLY -> date.plusWeeks(1);
            case MONTHLY -> date.plusMonths(1);
            case WEEKDAYS -> switch (date.getDayOfWeek()) {
                case FRIDAY -> date.plusDays(3);
                case SATURDAY -> date.plusDays(2);
                default -> date.plusDays(1);
            };
        };
    }
}
