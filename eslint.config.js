import js from '@eslint/js'
import prettier from 'eslint-config-prettier'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  {
    ignores: [
      'dist',
      'coverage',
      'playwright-report',
      'test-results',
      'public',
      '.cache',
      '.wrangler',
    ],
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2023,
      globals: { ...globals.browser, ...globals.node },
    },
  },
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [reactHooks.configs.flat.recommended, reactRefresh.configs.vite],
  },
  {
    // Code shared with the build and the Cloudflare Pages Function is bundled without Vite, so
    // the `@/` alias only works for type imports there; runtime imports must be relative.
    files: [
      'src/data/**/*.ts',
      'src/types/**/*.ts',
      'scripts/**/*.ts',
      'mcp/**/*.ts',
      'functions/**/*.ts',
    ],
    ignores: ['**/*.test.ts'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/*'],
              allowTypeImports: true,
              message:
                'Shared code may import "@/…" only as a type; use a relative path at runtime.',
            },
          ],
        },
      ],
    },
  },
  {
    // shadcn/ui generated components export variant helpers alongside components.
    files: ['src/components/ui/**/*.{ts,tsx}'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
  prettier,
)
