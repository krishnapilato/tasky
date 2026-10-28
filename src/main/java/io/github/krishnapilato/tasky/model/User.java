package io.github.krishnapilato.tasky.model;

public record User(long id, String name, String email, String passwordHash) {

    public record View(long id, String name, String email) { }

    public View view() {
        return new View(id, name, email);
    }
}