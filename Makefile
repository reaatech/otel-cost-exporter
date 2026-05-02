.PHONY: install build test test-coverage lint lint-fix format typecheck clean validate-pricing generate-pricing pricing-diff docker-build

install:
	pnpm install --frozen-lockfile

build:
	pnpm build

test:
	pnpm test

test-coverage:
	pnpm test:coverage

lint:
	pnpm lint

lint-fix:
	pnpm lint:fix

format:
	pnpm format

typecheck:
	pnpm typecheck

validate-pricing:
	pnpm validate-pricing

generate-pricing:
	pnpm generate-pricing

pricing-diff:
	pnpm pricing-diff

docker-build:
	docker build -t otel-cost-exporter:latest -f docker/Dockerfile .

docker-push:
	docker push ghcr.io/reaatech/otel-cost-exporter:latest

clean:
	pnpm clean
