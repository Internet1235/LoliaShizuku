FROM oven/bun:1 AS frontend
WORKDIR /src/frontend
COPY frontend/package.json frontend/package.json.md5 ./
RUN bun install
COPY frontend/ ./
RUN bun run build

FROM golang:1.25 AS backend
WORKDIR /src
COPY go.mod go.sum ./
RUN go mod download
COPY . .
COPY --from=frontend /src/frontend/dist ./frontend/dist
RUN CGO_ENABLED=0 go build -tags web -o /out/loliashizuku-web .

FROM debian:bookworm-slim
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=backend /out/loliashizuku-web ./loliashizuku-web
COPY --from=frontend /src/frontend/dist ./frontend/dist
ENV LOLIA_WEB_ADDR=:8080
EXPOSE 8080
ENTRYPOINT ["./loliashizuku-web"]