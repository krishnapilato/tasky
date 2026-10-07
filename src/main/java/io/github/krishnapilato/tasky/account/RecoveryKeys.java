package io.github.krishnapilato.tasky.account;

import module java.base;

public final class RecoveryKeys {
    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    private static final byte[] PURPOSE = "tasky recovery key".getBytes(StandardCharsets.UTF_8);
    private static final SecureRandom RANDOM = new SecureRandom();

    private RecoveryKeys() {}

    public static String create() {
        return RANDOM.ints(20, 0, ALPHABET.length())
                .mapToObj(index -> String.valueOf(ALPHABET.charAt(index)))
                .gather(Gatherers.windowFixed(5))
                .map(group -> String.join("", group))
                .collect(Collectors.joining("-"));
    }

    public static String fingerprint(String key, String owner) {
        try {
            var material = key.toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "").getBytes(StandardCharsets.UTF_8);
            var derivation = HKDFParameterSpec.ofExtract()
                    .addIKM(material)
                    .addSalt(owner.getBytes(StandardCharsets.UTF_8))
                    .thenExpand(PURPOSE, 32);
            return HexFormat.of().formatHex(KDF.getInstance("HKDF-SHA256").deriveData(derivation));
        } catch (GeneralSecurityException unsupported) {
            throw new IllegalStateException(unsupported);
        }
    }

    public static boolean matches(String key, String owner, String fingerprint) {
        return fingerprint != null && MessageDigest.isEqual(fingerprint.getBytes(StandardCharsets.UTF_8), fingerprint(key, owner).getBytes(StandardCharsets.UTF_8));
    }
}
