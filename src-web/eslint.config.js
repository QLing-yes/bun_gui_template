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
      // 架构边界：Tauri IPC 只允许在 @/lib/tauri，Eden 只允许在 @/lib/api，IndexedDB 只允许在 @/lib/storage
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@tauri-apps/api*'], message: 'Tauri IPC 只允许在 @/lib/tauri 中使用' },
          { group: ['@elysia/eden'], message: 'Eden 只允许在 @/lib/api 中使用' },
          { group: ['dexie'], message: 'IndexedDB 只允许在 @/lib/storage 中使用' },
        ],
      }],
      // 网络请求统一走 @/lib/api；持久化统一走 @/lib/storage 的异步 API
      'no-restricted-globals': ['error',
        { name: 'fetch', message: '请通过 @/lib/api 发起请求' },
        { name: 'localStorage', message: '持久化请走 @/lib/storage 的异步 API' },
        { name: 'sessionStorage', message: '持久化请走 @/lib/storage 的异步 API' },
        { name: 'indexedDB', message: '持久化请走 @/lib/storage 的异步 API' },
      ],
      // 主题首帧提示 cookie 只允许在持久化门面写入
      'no-restricted-properties': ['error', {
        object: 'document',
        property: 'cookie',
        message: '主题首帧提示 cookie 只允许在 @/lib/storage 写入',
      }],
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
    // 持久化门面：允许直连 Dexie/IndexedDB，并保留首次迁移所需的 localStorage 访问
    files: ['src/lib/storage.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        patterns: [
          { group: ['@tauri-apps/api*'], message: 'Tauri IPC 只允许在 @/lib/tauri 中使用' },
          { group: ['@elysia/eden'], message: 'Eden 只允许在 @/lib/api 中使用' },
        ],
      }],
      'no-restricted-globals': ['error', { name: 'fetch', message: '请通过 @/lib/api 发起请求' }],
      'no-restricted-properties': 'off',
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
