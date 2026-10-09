package io.github.krishnapilato.tasky.web;

import io.github.krishnapilato.tasky.Database;
import io.github.krishnapilato.tasky.Passwords;
import io.github.krishnapilato.tasky.model.User;
import jakarta.persistence.EntityManager;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

public class AccountServlet extends JsonServlet {

    public record Form(String name, String email, String password) { }

    public record Account(boolean demo, User.View user) { }

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
        var user = signedIn(request).map(id -> Database.call(database -> database.find(User.class, id).view()));
        send(response, 200, new Account(false, user.orElse(null)));
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws IOException {
        switch (text(request.getPathInfo())) {
            case "/register" -> signIn(request, response, register(read(request, Form.class)));
            case "/login" -> signIn(request, response, login(read(request, Form.class)));
            case "/logout" -> signOut(request, response);
            default -> throw new Problem(404, "Not found");
        }
    }

    private User register(Form form) {
        var name = text(form.name());
        var email = text(form.email()).toLowerCase();
        if (name.isEmpty() || name.length() > 80) throw new Problem(422, "Enter your name");
        if (!email.matches("[^@\\s]+@[^@\\s]+\\.[^@\\s]+")) throw new Problem(422, "Enter a valid email address");
        if (text(form.password()).length() < 8) throw new Problem(422, "Use at least 8 characters for the password");
        return Database.call(database -> {
            if (find(database, email) != null) throw new Problem(409, "An account with this email already exists");
            var user = new User(name, email, Passwords.hash(form.password()));
            database.persist(user);
            return user;
        });
    }

    private User login(Form form) {
        var user = Database.call(database -> find(database, text(form.email()).toLowerCase()));
        if (user == null || form.password() == null || !Passwords.matches(form.password(), user.passwordHash())) throw new Problem(401, "Email or password is incorrect");
        return user;
    }

    private User find(EntityManager database, String email) {
        return database.createQuery("from User where email = :email", User.class)
                .setParameter("email", email)
                .getSingleResultOrNull();
    }

    private void signIn(HttpServletRequest request, HttpServletResponse response, User user) throws IOException {
        request.getSession().setAttribute(USER_ID, user.id());
        request.changeSessionId();
        send(response, 200, user.view());
    }

    private void signOut(HttpServletRequest request, HttpServletResponse response) {
        request.getSession().invalidate();
        response.setStatus(204);
    }
}
