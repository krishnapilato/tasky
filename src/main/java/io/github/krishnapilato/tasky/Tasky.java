package io.github.krishnapilato.tasky;

import io.github.krishnapilato.tasky.web.Server;
import org.apache.catalina.util.ServerInfo;
import org.apache.logging.log4j.LogManager;
import org.apache.logging.log4j.jul.Log4jBridgeHandler;
import org.h2.engine.Constants;
import org.hibernate.Version;

public class Tasky {

    void main() throws Exception {
        Log4jBridgeHandler.install(true, null, true);
        LogManager.getLogger(Tasky.class).info("Starting on Java {} with Tomcat {}, Hibernate {} and H2 {}",
                Runtime.version().feature(), ServerInfo.getServerNumber(), Version.getVersionString(), Constants.VERSION);
        Seed.load();
        Server.run(Integer.parseInt(System.getenv().getOrDefault("PORT", "8080")));
    }
}
