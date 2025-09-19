import noUnknownParams from "./lib/rules/no-unknown-params.js";

export default {
  meta: {
    name: "@jsenv/eslint-plugin",
    version: "1.0.0",
  },
  rules: {
    "no-unknown-params": noUnknownParams,
  },
  configs: {
    recommended: {
      plugins: ["@jsenv"],
      rules: {
        "@jsenv/no-unknown-params": "warn",
      },
    },
  },
};
