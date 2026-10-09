package io.github.krishnapilato.tasky.web;

import org.apache.catalina.LifecycleException;
import org.apache.catalina.WebResourceRoot.ResourceSetType;
import org.apache.catalina.servlets.DefaultServlet;
import org.apache.catalina.startup.Tomcat;
import org.apache.catalina.webresources.StandardRoot;
import org.apache.logging.log4j.jul.Log4jBridgeHandler;
import org.apache.tomcat.util.http.Rfc6265CookieProcessor;

import java.io.IOException;
import java.nio.file.Files;

public final class Server {

    private Server() {}

    public static void run(int port) throws IOException {
        Log4jBridgeHandler.install(true, null, true);
        var tomcat = new Tomcat();
        tomcat.setBaseDir(Files.createTempDirectory("tasky").toString());
        tomcat.setPort(port);
        tomcat.getConnector().setThrowOnFailure(true);

        var context = tomcat.addContext("", null);
        var files = new StandardRoot(context);
        files.createWebResourceSet(ResourceSetType.RESOURCE_JAR, "/", Server.class.getProtectionDomain().getCodeSource().getLocation(), "/web");
        context.setResources(files);
        context.addWelcomeFile("index.html");
        Tomcat.addDefaultMimeTypeMappings(context);

        var cookies = new Rfc6265CookieProcessor();
        cookies.setSameSiteCookies("strict");
        context.setCookieProcessor(cookies);

        Tomcat.addServlet(context, "files", new DefaultServlet()).addMapping("/");
        Tomcat.addServlet(context, "account", new AccountServlet()).addMapping("/api/account/*");
        Tomcat.addServlet(context, "tasks", new TaskServlet()).addMapping("/api/tasks/*");

        try {
            tomcat.start();
        } catch (LifecycleException failure) {
            throw new IllegalStateException("Could not start on port %d. Stop the program that is using it, or set PORT to a free port.".formatted(port), failure);
        }
        IO.println("Tasky is running on http://localhost:" + port);
        tomcat.getServer().await();
    }
}
