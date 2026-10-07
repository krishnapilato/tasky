package io.github.krishnapilato.tasky.core;

import module java.base;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.MapperFeature;
import tools.jackson.databind.cfg.EnumFeature;
import tools.jackson.databind.json.JsonMapper;

public final class Json {
    private static final LazyConstant<JsonMapper> MAPPER = LazyConstant.of(() -> JsonMapper.builder()
            .enable(EnumFeature.WRITE_ENUMS_TO_LOWERCASE)
            .enable(MapperFeature.ACCEPT_CASE_INSENSITIVE_ENUMS)
            .build());

    private Json() {}

    public static <T> T read(byte[] source, Class<T> type) {
        try {
            return MAPPER.get().readValue(source, type);
        } catch (JacksonException malformed) {
            throw Stream.<Throwable>iterate(malformed, Objects::nonNull, Throwable::getCause)
                    .filter(Problem.class::isInstance)
                    .map(Problem.class::cast)
                    .findFirst()
                    .orElseGet(() -> new Problem(400, "The request body is not valid JSON for this endpoint"));
        }
    }

    public static void write(OutputStream target, Object value) {
        MAPPER.get().writeValue(target, value);
    }
}
