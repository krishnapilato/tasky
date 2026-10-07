package io.github.krishnapilato.tasky.web;

import module java.base;
import io.github.krishnapilato.tasky.core.Json;
import io.github.krishnapilato.tasky.core.Problem;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

public record Exchange(HttpServletRequest request, HttpServletResponse response, Map<String, String> path) {

    private static final int BODY_LIMIT = 64 * 1024;
    private static final Map<String, ZoneId> ZONES = Map.ofLazy(ZoneId.getAvailableZoneIds(), ZoneId::of);

    public <T> T body(Class<T> type) {
        try {
            var bytes = request.getInputStream().readNBytes(BODY_LIMIT + 1);
            if (bytes.length > BODY_LIMIT) throw new Problem(413, "The request body is too large");
            return Json.read(bytes, type);
        } catch (IOException _) {
            throw new Problem(400, "The request body could not be read");
        }
    }

    public long id() {
        return Long.parseLong(path.get("id"));
    }

    public ZoneId zone() {
        return Optional.ofNullable(request.getHeader("X-Time-Zone")).map(ZONES::get).orElse(ZoneOffset.UTC);
    }

    public Optional<String> cookie(String name) {
        return Stream.ofNullable(request.getCookies())
                .flatMap(Arrays::stream)
                .filter(cookie -> cookie.getName().equals(name))
                .map(Cookie::getValue)
                .findFirst();
    }

    public void cookie(String name, String value, Duration lifetime) {
        var cookie = new Cookie(name, value);
        cookie.setPath("/");
        cookie.setHttpOnly(true);
        cookie.setSecure(request.isSecure());
        cookie.setMaxAge(Math.toIntExact(lifetime.toSeconds()));
        cookie.setAttribute("SameSite", "Strict");
        response.addCookie(cookie);
    }
}
