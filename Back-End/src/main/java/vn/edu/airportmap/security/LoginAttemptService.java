package vn.edu.airportmap.security;

import org.springframework.stereotype.Component;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// Slows down password guessing: after 5 wrong logins from one address in 15 minutes, that address must wait.
// Kept in memory: a restart clears it, which is fine for a single small server.
@Component
public class LoginAttemptService {
    static final int MAX_FAILURES = 5;
    static final Duration WINDOW = Duration.ofMinutes(15);

    private final Map<String, Deque<Instant>> failures = new ConcurrentHashMap<>();

    public boolean isBlocked(String client) {
        Deque<Instant> recent = failures.computeIfPresent(client, (key, times) -> prune(times));
        return recent != null && recent.size() >= MAX_FAILURES;
    }

    public void recordFailure(String client) {
        failures.compute(client, (key, times) -> {
            Deque<Instant> list = times == null ? new ArrayDeque<>() : prune(times);
            list.addLast(Instant.now());
            return list;
        });
    }

    public void reset(String client) {
        failures.remove(client);
    }

    // Forget failures older than WINDOW; returning null removes the entry from the map
    private static Deque<Instant> prune(Deque<Instant> times) {
        Instant limit = Instant.now().minus(WINDOW);
        while (!times.isEmpty() && times.peekFirst().isBefore(limit)) {
            times.pollFirst();
        }
        return times.isEmpty() ? null : times;
    }
}
