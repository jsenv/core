import { rulesRelax } from "@jsenv/eslint-config-relax";
import html from "eslint-plugin-html";

export default [
  {
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
