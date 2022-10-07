/**
 * This super basic ESLint configuration to parse latest js
 */

export const eslintConfigBase = {
  parserOptions: {
    sourceType: "module",
  },
  env: {
    es2021: true,
  },
  settings: {
    extensions: [".js", ".mjs"],
  },
}
