package io.github.krishnapilato.tasky.account;

import module java.base;

public final class Passwords {
    private static final String ALGORITHM = "PBKDF2WithHmacSHA256";
    private static final int ITERATIONS = 600_000;
    private static final int KEY_BITS = 256;
    private static final SecureRandom RANDOM = new SecureRandom();
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();

    private Passwords() {}

    public static String hash(String password) {
        var salt = new byte[16];
        RANDOM.nextBytes(salt);
        return "%d:%s:%s".formatted(ITERATIONS, ENCODER.encodeToString(salt), ENCODER.encodeToString(derive(password, salt, ITERATIONS)));
    }

    public static boolean matches(String password, String hash) {
        var parts = hash.split(":");
        var expected = DECODER.decode(parts[2]);
        return MessageDigest.isEqual(expected, derive(password, DECODER.decode(parts[1]), Integer.parseInt(parts[0])));
    }

    private static byte[] derive(String password, byte[] salt, int iterations) {
        try {
            var spec = new PBEKeySpec(password.toCharArray(), salt, iterations, KEY_BITS);
            return SecretKeyFactory.getInstance(ALGORITHM).generateSecret(spec).getEncoded();
        } catch (GeneralSecurityException unsupported) {
            throw new IllegalStateException(unsupported);
        }
    }
}
