import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import hooks from 'eslint-plugin-react-hooks';
import refresh from 'eslint-plugin-react-refresh';

export default tseslint.config(
  { ignores: ['node_modules/**', 'dist/**', '.local/**', 'playwright-report/**', 'test-results/**'] },
  js.configs.recommended, ...tseslint.configs.recommended,
  { languageOptions: { globals: { process: 'readonly', console: 'readonly' } } },
  { files: ['src/**/*.{ts,tsx}'], plugins: { 'react-hooks': hooks, 'react-refresh': refresh },
    rules: { ...hooks.configs.recommended.rules, 'react-refresh/only-export-components': ['warn', { allowConstantExport: true }] } },
);
