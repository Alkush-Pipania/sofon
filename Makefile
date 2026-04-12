SHELL := /bin/bash

COMPOSE_FILE := deploy/docker-compose.yml
COMPOSE := docker compose -f $(COMPOSE_FILE)
DB_URL := postgres://myuser:mypassword@postgres:5432/mydb?sslmode=disable

.PHONY: help build up down restart logs ps migrate-up migrate-down migrate-status clean soft-clean

help:
	@echo "Sofon Docker Commands"
	@echo ""
	@echo "make build          Build API and Web images"
	@echo "make up             Start all services in detached mode"
	@echo "make down           Stop and remove containers/networks"
	@echo "make restart        Restart full stack"
	@echo "make logs           Follow logs for all services"
	@echo "make ps             Show service status"
	@echo "make migrate-up     Apply DB migrations with goose"
	@echo "make migrate-down   Roll back 1 migration"
	@echo "make migrate-status Show migration status"
	@echo "make soft-clean     Remove stopped containers + dangling images only"
	@echo "make clean          Prune all unused docker data (careful)"

build:
	$(COMPOSE) build api web

up:
	$(COMPOSE) up -d --build

down:
	$(COMPOSE) down

restart: down up

logs:
	$(COMPOSE) logs -f --tail=200

ps:
	$(COMPOSE) ps

migrate-up:
	$(COMPOSE) run --rm migrate ./goose -dir ./migration postgres "$(DB_URL)" up

migrate-down:
	$(COMPOSE) run --rm migrate ./goose -dir ./migration postgres "$(DB_URL)" down

migrate-status:
	$(COMPOSE) run --rm migrate ./goose -dir ./migration postgres "$(DB_URL)" status

soft-clean:
	docker container prune -f
	docker image prune -f
	docker builder prune -f

clean:
	docker system prune -af --volumes
