import html from "eslint-plugin-html";
import { rulesRelax } from "./rules_relax.js";

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
