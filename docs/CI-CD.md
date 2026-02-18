# CI/CD Workflows

This project uses GitHub Actions for continuous integration and code quality checks.

## Workflows

### CI Pipeline (`ci.yml`)

Runs on every push to `main` and on all pull requests.

**Jobs:**
1. **Lint & Type Check**: Runs ESLint and TypeScript type checking across the monorepo
2. **Build Services**: Builds all NestJS services (order, inventory, payment) in parallel
3. **Build Dashboard**: Builds the Next.js dashboard with production configuration
4. **Prisma Validation**: Generates and validates Prisma schemas for all services
5. **Build Packages**: Builds all shared packages (@orderflow/common, logger, kafka)

### Code Quality (`code-quality.yml`)

Runs on pull requests only.

**Jobs:**
1. **Format Check**: Verifies code formatting with Prettier
2. **Security Audit**: Runs `pnpm audit` to check for vulnerable dependencies

## Local Testing

To run the same checks locally before pushing:

```bash
# Lint
pnpm run lint

# Type check
pnpm run typecheck

# Format check
pnpm run format:check

# Build all
pnpm run build

# Security audit
pnpm audit
```

## Workflow Triggers

- **Main CI**: Triggered on push to `main` and on pull requests
- **Code Quality**: Triggered on pull requests only

## Required Checks

Before merging a pull request, all CI jobs must pass:
- ✅ Lint & Type Check
- ✅ All services build successfully
- ✅ Dashboard builds successfully
- ✅ Prisma schemas are valid
- ✅ Shared packages build successfully
- ✅ Code is properly formatted

## Troubleshooting

### Build Failures

If builds fail in CI but pass locally:
1. Ensure you've committed all changes (including `package.json` and lockfile)
2. Try a clean install: `rm -rf node_modules pnpm-lock.yaml && pnpm install`
3. Check that Prisma schemas are generated: `pnpm run prisma:generate`

### Lint Failures

Run `pnpm run lint --fix` locally to auto-fix most issues.

### Format Failures

Run `pnpm run format` to auto-format code.
