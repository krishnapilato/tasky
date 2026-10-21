package io.github.krishnapilato.tasky;

import module java.base;

public final class Passwords {

    private static final SecureRandom RANDOM = new SecureRandom();

    private Passwords() {}

    public static String hash(String password) {
        var salt = new byte[16];
        RANDOM.nextBytes(salt);
        return Base64.getEncoder().encodeToString(salt) + ":" + Base64.getEncoder().encodeToString(derive(password, salt));
    }

    public static boolean matches(String password, String hash) {
        var parts = hash.split(":");
        return MessageDigest.isEqual(Base64.getDecoder().decode(parts[1]), derive(password, Base64.getDecoder().decode(parts[0])));
    }

    private static byte[] derive(String password, byte[] salt) {
        try {
            var spec = new PBEKeySpec(password.toCharArray(), salt, 600_000, 256);
            return SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256").generateSecret(spec).getEncoded();
        } catch (GeneralSecurityException unsupported) {
            throw new IllegalStateException(unsupported);
        }
    }
}