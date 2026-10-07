package io.github.krishnapilato.tasky.account;

import module java.base;
import java.security.Signature;

public final class Tokens {
    public record Claims(long userId, int epoch, Instant expiresAt) {}

    public static final Duration LIFETIME = Duration.ofDays(7);

    private static final String ALGORITHM = "Ed25519";
    private static final LazyConstant<KeyPair> KEYS = LazyConstant.of(Tokens::generateKeys);
    private static final Base64.Encoder ENCODER = Base64.getUrlEncoder().withoutPadding();
    private static final Base64.Decoder DECODER = Base64.getUrlDecoder();

    private Tokens() {}

    public static String issue(long userId, int epoch) {
        var payload = "%d.%d.%d".formatted(userId, epoch, Instant.now().plus(LIFETIME).getEpochSecond());
        return payload + "." + ENCODER.encodeToString(sign(payload));
    }

    public static Optional<Claims> verify(String token) {
        var cut = token.lastIndexOf('.');
        if (cut < 0 || !signed(token.substring(0, cut), token.substring(cut + 1))) return Optional.empty();
        var parts = token.substring(0, cut).split("\\.");
        var claims = new Claims(Long.parseLong(parts[0]), Integer.parseInt(parts[1]), Instant.ofEpochSecond(Long.parseLong(parts[2])));
        return Optional.of(claims).filter(valid -> valid.expiresAt().isAfter(Instant.now()));
    }

    public static String publicKeyPem() {
        return PEMEncoder.of().encodeToString(KEYS.get().getPublic());
    }

    private static byte[] sign(String payload) {
        try {
            var signature = Signature.getInstance(ALGORITHM);
            signature.initSign(KEYS.get().getPrivate());
            signature.update(payload.getBytes(StandardCharsets.UTF_8));
            return signature.sign();
        } catch (GeneralSecurityException unsupported) {
            throw new IllegalStateException(unsupported);
        }
    }

    private static boolean signed(String payload, String encodedSignature) {
        try {
            var signature = Signature.getInstance(ALGORITHM);
            signature.initVerify(KEYS.get().getPublic());
            signature.update(payload.getBytes(StandardCharsets.UTF_8));
            return signature.verify(DECODER.decode(encodedSignature));
        } catch (GeneralSecurityException | IllegalArgumentException _) {
            return false;
        }
    }

    private static KeyPair generateKeys() {
        try {
            return KeyPairGenerator.getInstance(ALGORITHM).generateKeyPair();
        } catch (NoSuchAlgorithmException unsupported) {
            throw new IllegalStateException(unsupported);
        }
    }
}
