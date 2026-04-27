# Contributing to otel-cost-exporter

Thank you for your interest in contributing to otel-cost-exporter! This document provides guidelines and instructions for contributing to this project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [How to Contribute](#how-to-contribute)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Testing](#testing)
- [Documentation](#documentation)
- [Release Process](#release-process)

## Code of Conduct

### Our Pledge

We as members, contributors, and leaders pledge to make participation in our community a harassment-free experience for everyone, regardless of age, body size, visible or invisible disability, ethnicity, sex characteristics, gender identity and expression, level of experience, education, socio-economic status, nationality, personal appearance, race, religion, or sexual identity and orientation.

### Our Standards

Examples of behavior that contributes to a positive environment:

- Using welcoming and inclusive language
- Being respectful of differing viewpoints and experiences
- Gracefully accepting constructive criticism
- Focusing on what is best for the community
- Showing empathy towards other community members

Examples of unacceptable behavior:

- The use of sexualized language or imagery and unwelcome sexual attention
- Trolling, insulting/derogatory comments, and personal or political attacks
- Public or private harassment
- Publishing others' private information without explicit permission
- Other conduct which could reasonably be considered inappropriate

## Getting Started

### Prerequisites

- Node.js 22 or higher
- pnpm 9 or higher (install via `corepack enable && corepack prepare pnpm@9 --activate`)
- Git
- Docker (for container builds)

### Fork and Clone

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/otel-cost-exporter.git
   cd otel-cost-exporter
   ```
3. Add the upstream remote:
   ```bash
   git remote add upstream https://github.com/reaatech/otel-cost-exporter.git
   ```

## Development Setup

### Install Dependencies

```bash
# Enable pnpm via corepack (Node 22+)
corepack enable
corepack prepare pnpm@9 --activate

# Install dependencies
pnpm install --frozen-lockfile
```

### Configure Your Environment

```bash
# Copy example configuration
cp .env.example .env

# Set up pre-commit hooks
pnpm prepare
```

### Verify Setup

```bash
# Run tests
make test

# Build the project
make build

# Run linting
make lint

# Check types
make typecheck
```

## How to Contribute

### Types of Contributions

#### 1. Bug Fixes

Bug fixes are always welcome! Here's how to contribute:

1. Check existing issues to see if the bug is already reported
2. If not, create a new issue with:
   - Clear description of the bug
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment information
3. Create a branch and fix the bug
4. Add tests to prevent regression
5. Submit a pull request

#### 2. New Features

We welcome new feature contributions:

1. **Discuss first**: Create an issue to discuss the feature
2. **Design**: Work with maintainers on the design
3. **Implement**: Create the feature following our standards
4. **Document**: Update documentation
5. **Test**: Add comprehensive tests
6. **Submit**: Create a pull request

#### 3. Pricing Table Updates

To update pricing tables:

1. See [skills/pricing-update.md](skills/pricing-update.md)
2. Update the relevant pricing file in `pricing-tables/`
3. Update the version number
4. Run validation: `pnpm validate-pricing`
5. Submit a pull request

#### 4. Adding New Models/Providers

To add support for new LLM models or providers:

1. See [skills/model-addition.md](skills/model-addition.md)
2. Create pricing table entry
3. Add normalization rules
4. Add tests
5. Update documentation
6. Submit a pull request

#### 5. Documentation

Documentation improvements are valuable:

- Fix typos or unclear explanations
- Add examples
- Improve API documentation
- Add tutorials or guides

#### 6. Code Reviews

You can help by reviewing pull requests:

- Check for code quality
- Verify tests are adequate
- Ensure documentation is updated
- Test the changes locally

## Pull Request Process

### Before Submitting

1. **Update your branch**:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Run all checks**:
   ```bash
   make pre-commit
   ```

3. **Update documentation** if needed

4. **Add tests** for new functionality

### Creating the PR

1. Push your branch:
   ```bash
   git push origin feature/your-feature
   ```

2. Create a pull request on GitHub

3. Use the PR template and fill in all sections

### PR Title Format

Use conventional commits format:

- `feat: add support for Claude 3 models`
- `fix: correct pricing calculation for GPT-4`
- `docs: update configuration examples`
- `test: add integration tests for OTLP export`
- `chore: update dependencies`

### PR Description

Include:

- **What**: Clear description of changes
- **Why**: Motivation and context
- **How**: Implementation details
- **Testing**: How changes were tested
- **Checklist**: Complete the PR checklist

### Review Process

1. **Automated checks** must pass
2. **Code review** by maintainers
3. **Address feedback** promptly
4. **Approval** required from at least one maintainer
5. **Merge** by maintainer after approval

## Coding Standards

This project follows the coding standards documented in [AGENTS.md](AGENTS.md). Please review that document for:

- TypeScript code style and import ordering
- Naming conventions
- Code organization (src/ layout)
- Architectural patterns (dependency injection, factory, options, middleware, concurrency)
- Testing requirements, structure, and coverage thresholds

### Linting

```bash
# Run all linters
make lint

# Fix auto-fixable issues
make lint-fix

# Check formatting
make format-check

# Run type checking
make typecheck
```

Linter configuration is in `eslint.config.mjs`.

### Testing

Testing framework: Vitest 2+ with `@vitest/coverage-v8`. See [AGENTS.md](AGENTS.md) for detailed test structure, coverage requirements, and benchmark patterns.

### Test Coverage Requirements

| Component | Minimum Coverage |
|-----------|-----------------|
| Core calculation | 95% |
| Pricing tables | 90% |
| Configuration | 85% |
| Exporters | 80% |
| Overall | 85% |

### Running Tests

```bash
# Run all tests
make test

# Run with coverage
make test-coverage

# Run specific tests
pnpm vitest run src/pricing

# Run tests in watch mode
make test-watch

# Run benchmarks
pnpm vitest bench
```

### Integration Tests

```bash
# Run integration tests
pnpm vitest run tests/integration
```

## Documentation

### Code Documentation

- Document all exported types, functions, and packages
- Include examples for complex functionality
- Use godoc format for documentation comments

### User Documentation

- Update README.md for user-facing changes
- Add configuration examples
- Include migration guides for breaking changes
- Update API documentation

### Architecture Documentation

- Update ARCHITECTURE.md for significant changes
- Add diagrams for complex systems
- Document design decisions

## Release Process

### Versioning

We follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backward compatible)
- **PATCH**: Bug fixes (backward compatible)

### Release Checklist

Before a release:

- [ ] All tests passing
- [ ] Code coverage requirements met
- [ ] Documentation updated
- [ ] CHANGELOG.md updated
- [ ] Version numbers updated
- [ ] Security scan passed

### Creating a Release

See [skills/release-procedure.md](skills/release-procedure.md) for detailed release procedures.

## Getting Help

### Resources

- **Documentation**: Check the `docs/` directory
- **Skills**: Review `skills/` for specific procedures
- **Issues**: Search existing GitHub issues
- **Discussions**: GitHub Discussions for questions

### Contact

- **General questions**: GitHub Discussions
- **Bug reports**: GitHub Issues
- **Security issues**: rick@reaatech.com

## Recognition

Contributors are recognized in:

- CHANGELOG.md
- README.md (for significant contributions)
- GitHub Contributors page

## License

By contributing, you agree that your contributions will be licensed under the MIT License. See [LICENSE](LICENSE) for details.
