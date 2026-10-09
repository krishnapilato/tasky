FROM eclipse-temurin:27-jdk AS build
COPY --from=maven:3.9 /usr/share/maven /usr/share/maven
WORKDIR /build
COPY pom.xml .
COPY src src
RUN --mount=type=cache,target=/root/.m2 /usr/share/maven/bin/mvn --batch-mode --no-transfer-progress package

FROM eclipse-temurin:27-jre
WORKDIR /app
COPY --from=build /build/target/tasky.jar tasky.jar
USER 10001
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "tasky.jar"]