import { rulesRelax } from "@jsenv/eslint-config-relax";
import html from "eslint-plugin-html";
import globals from "globals";

export default [
  {
    // eslint 10 resolves the config from each linted file's directory upward,
    // so this fixture no longer inherits the repo root config
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      ...rulesRelax,
    },
  },
  {
    files: ["**/*.html"],
    plugins: { html },
    settings: {
      "html/javascript-mime-types": [
        "text/javascript",
        "module",
        "text/jsx",
        "module/jsx",
      ],
    },
  },
];
