import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'types']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      'react-refresh/only-export-components': 'off',
      // 架构边界：Tauri IPC 只允许在 @/lib/tauri，Eden 只允许在 @/lib/api
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@tauri-apps/api*'], message: 'Tauri IPC 只允许在 @/lib/tauri 中使用' },
          { group: ['@elysia/eden'], message: 'Eden 只允许在 @/lib/api 中使用' },
        ],
      }],
      // 网络请求统一走 @/lib/api（onRequest 注入鉴权头）
      'no-restricted-globals': ['error', { name: 'fetch', message: '请通过 @/lib/api 发起请求' }],
    },
  },
  {
    files: ['src/lib/tauri/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['@elysia/eden'], message: 'Eden 只允许在 @/lib/api 中使用' }],
      }],
    },
  },
  {
    files: ['src/lib/api.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [{ group: ['@tauri-apps/api*'], message: 'Tauri IPC 只允许在 @/lib/tauri 中使用' }],
      }],
    },
  },
  {
    // AI 对话传输层：允许封装 fetch（AI SDK transport 注入 sidecar 鉴权头）
    files: ['src/lib/chat.ts'],
    rules: {
      'no-restricted-globals': 'off',
    },
  },
])
