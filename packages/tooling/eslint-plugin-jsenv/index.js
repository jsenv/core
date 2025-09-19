import { noUnknownParamsRule } from "./src/rule_no_unknown_params/no_unknown_params.js";

export { noUnknownParamsRule };

export default {
  meta: {
    name: "@jsenv/eslint-plugin",
    version: "1.0.0",
  },
  rules: {
    "no-unknown-params": noUnknownParamsRule,
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
