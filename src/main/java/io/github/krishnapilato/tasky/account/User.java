package io.github.krishnapilato.tasky.account;

import module java.base;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

@Entity
@Table(name = "users")
public class User {
    public record View(long id, String name, String email, Instant createdAt) {}

    @Id
    @GeneratedValue
    private Long id;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(nullable = false, unique = true, updatable = false, length = 254)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    private String recoveryFingerprint;

    private int sessionEpoch;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    protected User() {}

    public User(String name, String email, String password) {
        this.name = name;
        this.email = email;
        this.passwordHash = Passwords.hash(password);
        this.createdAt = Instant.now().truncatedTo(ChronoUnit.MILLIS);
    }

    public long id() {
        return id;
    }

    public int sessionEpoch() {
        return sessionEpoch;
    }

    public View view() {
        return new View(id, name, email, createdAt);
    }

    public boolean hasPassword(String password) {
        return Passwords.matches(password, passwordHash);
    }

    public boolean hasRecoveryKey(String key) {
        return RecoveryKeys.matches(key, email, recoveryFingerprint);
    }

    public void rename(String name) {
        this.name = name;
    }

    public void changePassword(String password) {
        passwordHash = Passwords.hash(password);
        sessionEpoch++;
    }

    public String issueRecoveryKey() {
        var key = RecoveryKeys.create();
        recoveryFingerprint = RecoveryKeys.fingerprint(key, email);
        return key;
    }

    public void acceptRecoveryKey(String key) {
        recoveryFingerprint = RecoveryKeys.fingerprint(key, email);
    }

    public void revokeRecoveryKey() {
        recoveryFingerprint = null;
    }
}
