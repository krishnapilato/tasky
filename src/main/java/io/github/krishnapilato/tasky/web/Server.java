package io.github.krishnapilato.tasky.web;

import module java.base;
import org.apache.catalina.LifecycleException;
import org.apache.catalina.WebResourceRoot.ResourceSetType;
import org.apache.catalina.filters.HttpHeaderSecurityFilter;
import org.apache.catalina.servlets.DefaultServlet;
import org.apache.catalina.startup.Tomcat;
import org.apache.catalina.webresources.StandardRoot;
import org.apache.logging.log4j.jul.Log4jBridgeHandler;

public final class Server implements AutoCloseable {
    private final Tomcat tomcat = new Tomcat();

    public Server(int port) throws IOException {
        Log4jBridgeHandler.install(true, null, true);
        tomcat.setBaseDir(Files.createTempDirectory("tasky").toString());
        tomcat.setPort(port);
        tomcat.getConnector().setThrowOnFailure(true);
        tomcat.getConnector().setProperty("useVirtualThreads", "true");
        tomcat.getConnector().setProperty("compression", "on");

        var context = tomcat.addContext("", null);
        var files = new StandardRoot(context);
        files.createWebResourceSet(ResourceSetType.RESOURCE_JAR, "/", Server.class.getProtectionDomain().getCodeSource().getLocation(), "/web");
        context.setResources(files);
        context.addWelcomeFile("index.html");
        Tomcat.addDefaultMimeTypeMappings(context);
        context.addMimeMapping("webmanifest", "application/manifest+json");
        context.addServletContainerInitializer((_, application) -> {
            application.addServlet("api", new Api()).addMapping("/api/*");
            application.addServlet("files", new DefaultServlet()).addMapping("/");
            application.addFilter("security-headers", new HttpHeaderSecurityFilter()).addMappingForUrlPatterns(null, false, "/*");
        }, null);

        try {
            tomcat.start();
        } catch (LifecycleException failure) {
            throw new IllegalStateException("Could not start on port %d. Stop the program that is using it, or set PORT to a free port.".formatted(port), failure);
        }
    }

    public int port() {
        return tomcat.getConnector().getLocalPort();
    }

    public void await() {
        tomcat.getServer().await();
    }

    @Override
    public void close() {
        try {
            tomcat.stop();
            tomcat.destroy();
        } catch (LifecycleException failure) {
            throw new IllegalStateException(failure);
        }
    }
}
