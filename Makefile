.PHONY: install build dev test test-watch test-coverage lint lint-fix format format-check typecheck pre-commit validate-pricing generate-pricing pricing-diff bump-patch docker-build docker-push security-scan security-lint security-update clean

install:
	pnpm install --frozen-lockfile

build:
	pnpm build

dev:
	pnpm dev

test:
	pnpm test

test-watch:
	pnpm test:watch

test-coverage:
	pnpm test:coverage

lint:
	pnpm lint

lint-fix:
	pnpm lint:fix

format:
	pnpm format

format-check:
	pnpm format:check

typecheck:
	pnpm typecheck

pre-commit:
	pnpm typecheck && pnpm lint && pnpm test:coverage

validate-pricing:
	pnpm validate-pricing

generate-pricing:
	pnpm generate-pricing

pricing-diff:
	pnpm pricing-diff

bump-patch:
	pnpm bump-patch

docker-build:
	docker build -t otel-cost-exporter:latest .

docker-push:
	docker push ghcr.io/reaatech/otel-cost-exporter:latest

security-scan:
	pnpm audit --audit-level=high

security-lint:
	pnpm security-lint

security-update:
	pnpm update --latest && pnpm audit --fix

clean:
	rm -rf dist coverage node_modules
