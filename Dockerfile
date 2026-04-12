# ─────────────────────────────────────────────────────────────────────────────
# Stage 1 – Build
# ─────────────────────────────────────────────────────────────────────────────
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Install goose for migrations
RUN go install github.com/pressly/goose/v3/cmd/goose@latest

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -o bin/server ./cmd/server

# ─────────────────────────────────────────────────────────────────────────────
# Stage 2 – Runtime
# ─────────────────────────────────────────────────────────────────────────────
FROM alpine:3.21

RUN apk --no-cache add ca-certificates tzdata

WORKDIR /app

LABEL org.opencontainers.image.source="https://github.com/Alkush-Pipania/sofon"

# Copy server binary
COPY --from=builder /app/bin/server ./server

# Copy goose binary (used by the migrate service)
COPY --from=builder /go/bin/goose ./goose

# Copy migration files (needed by goose)
COPY migration/ ./migration/

# Copy docker-specific config as the default config
COPY config/config.docker.yaml ./config.yaml

EXPOSE 8080

CMD ["./server"]
