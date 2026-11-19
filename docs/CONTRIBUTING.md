# Contributing Guide & Engineering Standards — QROS / MenuGo 🤝

Thank you for contributing to QROS! This guide outlines our engineering practices, Git workflows, commit conventions, and quality standards to ensure a clean, reliable, and maintainable codebase.

---

## 📋 Table of Contents
1. [Git Workflow & Branching](#1-git-workflow--branching)
2. [Commit Message Conventions](#2-commit-message-conventions)
3. [Monorepo Package Management](#3-monorepo-package-management)
4. [Coding Standards & TypeScript](#4-coding-standards--typescript)
5. [Database Migrations & Schema Changes](#5-database-migrations--schema-changes)
6. [Pre-PR Checklist](#6-pre-pr-checklist)

---

## 1. Git Workflow & Branching

We use a feature-branch workflow based off `main`:

```bash
# 1. Ensure your local main is up to date
git checkout main
git pull origin main

# 2. Create a feature or bugfix branch
git checkout -b feat/service-request-socket
# or
git checkout -b fix/mock-payment-removal
```

### Branch Naming Conventions
- `feat/<short-description>`: New user-facing feature or enhancement (e.g. `feat/cinema-seat-picker`).
- `fix/<short-description>`: Bugfix or issue resolution (e.g. `fix/table-session-leak`).
- `perf/<short-description>`: Performance improvement (e.g. `perf/kds-socket-optimizations`).
- `docs/<short-description>`: Documentation additions or revisions (e.g. `docs/api-guide`).
- `refactor/<short-description>`: Code restructuring without feature changes.

---

## 2. Commit Message Conventions

We adhere to the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short description in present tense>

[optional body providing technical context]

[optional issue reference, e.g., Closes #12]
```

### Supported Types
- `feat`: A new feature
- `fix`: A bug fix
- `docs`: Documentation updates
- `style`: Formatting, missing semicolons, etc. (no code change)
- `refactor`: Refactoring production code without changing behavior
- `perf`: Code change that improves performance
- `test`: Adding or correcting tests
- `chore`: Build process, auxiliary tools, dependency upgrades

### Examples
- `feat(restaurant): add live service request modal with socket broadcast`
- `fix(cinema): eliminate mock payment fallbacks in customer checkout`
- `docs(onboarding): add dual database setup instructions`
- `refactor(database): extract connection pool creation to helper`

---

## 3. Monorepo Package Management

We use **npm workspaces**. Always specify the target workspace when adding or updating packages:

```bash
# Add a dependency to a specific workspace
npm install @aws-sdk/client-s3 --workspace=@menugo/api

# Add a dev dependency to the shared package
npm install -D @types/node --workspace=@menugo/shared

# Add a root-level dev tool
npm install -D prettier --save-exact
```

Avoid running `npm install <pkg>` directly inside package subfolders; always run from the root using `--workspace`.

---

## 4. Coding Standards & TypeScript

### TypeScript Rules
- **No `any`**: Avoid `any` types wherever possible. Use `unknown` with type guards or define typed interfaces.
- **Zod for Boundaries**: All data entering the API (HTTP request bodies, query params, headers, WebSocket payloads) must be validated with Zod schemas defined in `packages/shared`.
- **Strict Null Checks**: Never ignore nullability; handle `undefined` and `null` explicitly.

### Architecture Guidelines
- **Tenant Isolation**: Every database query touching restaurant or cinema tables MUST filter by `restaurant_id` or `theatre_id`. Never execute unscoped updates or deletes.
- **Frontend State**: Prefer lightweight server-rendered components where applicable, keeping client interactivity contained to `'use client'` boundaries.
- **WebSocket Lifecycle**: Always clean up Socket.io event listeners in `useEffect` cleanup returns:
  ```typescript
  useEffect(() => {
    const socket = getSocket();
    socket.on('order:created', handleNewOrder);
    return () => {
      socket.off('order:created', handleNewOrder);
    };
  }, []);
  ```

---

## 5. Database Migrations & Schema Changes

When altering the database:

1. **Edit Schema**: Modify `packages/database/src/schema.ts`.
2. **Push or Generate**:
   ```bash
   # Push changes directly to dev database (fastest during development)
   npm run db:push

   # Generate an SQL migration file for production pipelines
   npm run db:generate
   ```
3. **Verify Compatibility**: Ensure existing columns with NOT NULL constraints provide default values or migrations handle existing records safely.

---

## 6. Pre-PR Checklist

Before opening a Pull Request or pushing to `main`, run the following quality gates:

```bash
# 1. Typecheck the entire monorepo
npm run typecheck

# 2. Run automated unit and integration tests
npm test

# 3. Run deployment smoke test
npm run smoke
```

All checks should pass with **0 errors**.
