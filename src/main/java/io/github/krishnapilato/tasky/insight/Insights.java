package io.github.krishnapilato.tasky.insight;

import module java.base;
import io.github.krishnapilato.tasky.account.Session;
import io.github.krishnapilato.tasky.core.Problem;
import io.github.krishnapilato.tasky.focus.FocusLog;
import io.github.krishnapilato.tasky.focus.FocusSession;
import io.github.krishnapilato.tasky.task.TaskView;
import io.github.krishnapilato.tasky.task.Tasks;
import java.util.concurrent.StructuredTaskScope.Joiner;

public final class Insights {
    public enum Momentum {
        RISING, STEADY, SLOWING
    }

    public record Day(LocalDate date, int done, int focusMinutes) {}

    public record Summary(int streak, int bestStreak, int doneThisWeek, int doneLastWeek, Momentum momentum,
                          int focusMinutesThisWeek, OptionalDouble onTimePercent, List<Day> activity) {}

    private static final int DAYS = 16 * 7;

    private Insights() {}

    public static Summary summarize() {
        var session = Session.current();
        try (var scope = StructuredTaskScope.open(Joiner.awaitAllSuccessfulOrThrow(Insights::unchecked))) {
            var tasks = scope.fork(Tasks::list);
            var focus = scope.fork(FocusLog::history);
            scope.join();
            return summarize(tasks.get(), focus.get(), session);
        } catch (InterruptedException interrupted) {
            Thread.currentThread().interrupt();
            throw new Problem(503, "Insights were interrupted, try again");
        }
    }

    private static Summary summarize(List<TaskView> tasks, List<FocusSession.View> focus, Session session) {
        var today = session.today();
        var finished = tasks.stream().filter(task -> task.completedAt() != null).toList();
        var doneByDay = finished.stream().collect(Collectors.groupingBy(task -> session.dayOf(task.completedAt()), Collectors.counting()));
        var focusByDay = focus.stream().collect(Collectors.groupingBy(entry -> session.dayOf(entry.endedAt()), Collectors.summingInt(FocusSession.View::minutes)));
        var activity = today.minusDays(DAYS - 1).datesUntil(today.plusDays(1))
                .map(date -> new Day(date, count(doneByDay.getOrDefault(date, 0L)), focusByDay.getOrDefault(date, 0)))
                .toList();
        var weeks = activity.stream().gather(Gatherers.windowFixed(7)).toList();
        var streaks = activity.stream().gather(Gatherers.scan(() -> 0, (streak, day) -> day.done() > 0 ? streak + 1 : 0)).toList();
        var doneThisWeek = done(weeks.getLast());
        var doneLastWeek = done(weeks.get(weeks.size() - 2));
        return new Summary(
                activity.getLast().done() > 0 ? streaks.getLast() : streaks.get(streaks.size() - 2),
                Collections.max(streaks),
                doneThisWeek,
                doneLastWeek,
                momentum(doneThisWeek, doneLastWeek),
                weeks.getLast().stream().mapToInt(Day::focusMinutes).sum(),
                finished.stream().filter(task -> task.due() != null).mapToInt(task -> session.dayOf(task.completedAt()).isAfter(task.due()) ? 0 : 100).average(),
                activity);
    }

    private static Momentum momentum(int thisWeek, int lastWeek) {
        return switch (thisWeek - lastWeek) {
            case int change when change > 0 -> Momentum.RISING;
            case int change when change < 0 -> Momentum.SLOWING;
            case int _ -> Momentum.STEADY;
        };
    }

    private static int done(List<Day> week) {
        return week.stream().mapToInt(Day::done).sum();
    }

    private static int count(long total) {
        return total instanceof int exact ? exact : Integer.MAX_VALUE;
    }

    private static RuntimeException unchecked(Throwable failure) {
        return failure instanceof RuntimeException known ? known : new IllegalStateException(failure);
    }
}
