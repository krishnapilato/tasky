package io.github.krishnapilato.tasky.model;

import jakarta.persistence.*;

@Entity
@Table(name = "users")
public class User {

    public record View(long id, String name, String email) { }

    @Id
    @GeneratedValue
    private Long id;

    @Column(nullable = false, length = 80)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(nullable = false)
    private String passwordHash;

    protected User() { }

    public User(String name, String email, String passwordHash) {
        this.name = name;
        this.email = email;
        this.passwordHash = passwordHash;
    }

    public long id() {
        return id;
    }

    public String passwordHash() {
        return passwordHash;
    }

    public View view() {
        return new View(id, name, email);
    }
}
