/**
 * This super basic ESLint configuration to parse latest js
 */

export const eslintConfigBase = {
  files: ["**/*.js", "**/*.mjs"],
  languageOptions: {
    sourceType: "module",
    ecmaVersion: 2022,
  },
};
