# Agent working rules

This is a pnpm + TypeScript project. Read `README.md` for what the app is and what each script
does.

After making changes from a prompt and **before committing**:

1. Author new tests covering the changes being made (Vitest unit tests; Playwright e2e tests for
   user-visible behaviour).
2. Update any documentation affected by the changes (`README.md`, this file, code comments).
3. Run `pnpm format-and-validate` and repair any regressions in-line. This runs the full e2e suite;
   never skip it.

Conventions:

- Tests import `describe`, `it`, and `expect` from `vitest` explicitly; test globals are off.
- Import from `src/` with the `@/` alias.
- UI primitives come from shadcn/ui in `src/components/ui/`; add new ones with
  `pnpm dlx shadcn@latest add <component>` rather than hand-writing them.
- Keep commits small and focused on one logical change.
