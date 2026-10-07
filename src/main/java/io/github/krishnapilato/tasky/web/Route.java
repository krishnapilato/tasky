package io.github.krishnapilato.tasky.web;

import module java.base;

public record Route(String method, Pattern path, Function<Exchange, Reply> handler) {
    public Route(String method, String template, Function<Exchange, Reply> handler) {
        this(method, Pattern.compile(template.replaceAll("\\{(\\w+)}", "(?<$1>\\\\d{1,18})")), handler);
    }

    public Optional<Map<String, String>> match(String candidate) {
        var matcher = path.matcher(candidate);
        if (!matcher.matches()) return Optional.empty();
        return Optional.of(path.namedGroups().keySet().stream().collect(Collectors.toMap(Function.identity(), matcher::group)));
    }
}
