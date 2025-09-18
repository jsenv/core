import noExtraParams from "./lib/rules/no-extra-params.js";

export default {
  meta: {
    name: "@jsenv/eslint-plugin",
    version: "1.0.0",
  },
  rules: {
    "no-extra-params": noExtraParams,
  },
  configs: {
    recommended: {
      plugins: ["@jsenv"],
      rules: {
        "@jsenv/no-extra-params": "warn",
      },
    },
  },
};
