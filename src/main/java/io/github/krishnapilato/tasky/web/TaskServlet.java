package io.github.krishnapilato.tasky.web;

import io.github.krishnapilato.tasky.Database;
import io.github.krishnapilato.tasky.model.Task;
import io.github.krishnapilato.tasky.model.TaskData;
import jakarta.persistence.EntityManager;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.io.IOException;

public class TaskServlet extends JsonServlet {

    @Override
    protected void doGet(HttpServletRequest request, HttpServletResponse response) throws IOException {
        var owner = userId(request);
        send(response, 200, Database.call(database -> database
                .createQuery("from Task where ownerId = :owner order by id", Task.class)
                .setParameter("owner", owner)
                .getResultStream()
                .map(Task::data)
                .toList()));
    }

    @Override
    protected void doPost(HttpServletRequest request, HttpServletResponse response) throws IOException {
        var task = new Task(userId(request), checked(read(request, TaskData.class)));
        Database.run(database -> database.persist(task));
        send(response, 201, task.data());
    }

    @Override
    protected void doPut(HttpServletRequest request, HttpServletResponse response) throws IOException {
        var owner = userId(request);
        var data = checked(read(request, TaskData.class));
        send(response, 200, Database.call(database -> {
            var task = find(database, request, owner);
            task.update(data);
            return task.data();
        }));
    }

    @Override
    protected void doDelete(HttpServletRequest request, HttpServletResponse response) {
        var owner = userId(request);
        Database.run(database -> database.remove(find(database, request, owner)));
        response.setStatus(204);
    }

    private Task find(EntityManager database, HttpServletRequest request, long owner) {
        var path = text(request.getPathInfo());
        var task = path.matches("/\\d{1,18}") ? database.find(Task.class, Long.valueOf(path.substring(1))) : null;
        if (task == null || task.ownerId() != owner) throw new Problem(404, "Task not found");
        return task;
    }

    private TaskData checked(TaskData data) {
        if (data.title().isEmpty()) throw new Problem(422, "Give the task a title");
        if (data.title().length() > 200) throw new Problem(422, "Keep the title under 200 characters");
        if (data.notes().length() > 2000) throw new Problem(422, "Keep the notes under 2000 characters");
        return data;
    }
}
