import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { 
    ignores: ['**/dist/**'] 
  },
  {
    extends: [
      js.configs.recommended, 
      ...tseslint.configs.recommended ],
    files: ['packages/*/src/*.ts'],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.node,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'warn',
    }
  },
);