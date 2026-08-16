// ESLint 9 扁平配置：目前仅覆盖后端 Node.js 代码（server/）
// 前端（admin / screen / mobile / miniapp）交给 Prettier 统一格式化，暂不启用 ESLint 检查
const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  {
    ignores: ['**/node_modules/**', '**/data/**', '**/uploads/**', 'miniapp/**'],
  },
  {
    files: ['server/**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
];
