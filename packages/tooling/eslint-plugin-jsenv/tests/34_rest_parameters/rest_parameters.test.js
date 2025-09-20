import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run(
  "no-unknown-params - rest parameters (...args)",
  noUnknownParamsRule,
  {
    valid: [
      {
        name: "Function with rest parameters should accept any spread params",
        code: `
const apiCall = (...args) => {
  return fetch(...args);
};

const wrapper = ({ endpoint, ...params }) => {
  console.log(endpoint);
  return apiCall({ ...params });
};

wrapper({ endpoint: "/api", method: "POST", headers: {} });`,
      },
      {
        name: "Arrow function with rest parameters",
        code: `
const handler = (...args) => console.log(args);

const process = ({ type, ...options }) => {
  return handler({ ...options });
};

process({ type: "user", name: "John", age: 30 });`,
      },
      {
        name: "Function declaration with rest parameters",
        code: `
function execute(...params) {
  return params;
}

const run = ({ action, ...config }) => {
  return execute({ ...config });
};

run({ action: "start", timeout: 5000, retry: true });`,
      },
      {
        name: "Multiple rest parameter functions in chain",
        code: `
const final = (...args) => args;
const middle = (...params) => final(...params);

const start = ({ id, ...rest }) => {
  return middle({ ...rest });
};

start({ id: 1, name: "test", active: true });`,
      },
      {
        name: "Rest parameters with mixed parameter types",
        code: `
const api = (url, ...options) => ({ url, options });

const request = ({ endpoint, ...config }) => {
  return api("/api", { ...config });
};

request({ endpoint: "/users", method: "GET", headers: {} });`,
      },
      {
        name: "External import with rest parameters (should be treated as accepting any params)",
        code: `
import { build } from "@jsenv/core";

const test = async ({ expectedFileCount, ...params }) => {
  console.log(expectedFileCount);
  await build({ ...params });
};

test({ minification: false, target: "node" });`,
      },
    ],
    invalid: [
      {
        name: "Known function without rest params should still error",
        code: `
const handler = ({ name }) => console.log(name);

const wrapper = ({ id, ...params }) => {
  return handler({ ...params });
};

wrapper({ id: 1, unknownParam: true });`,
        output: `
const handler = ({ name }) => console.log(name);

const wrapper = ({ id, ...params }) => {
  return handler({ ...params });
};

wrapper({ id: 1 });`,
        errors: [
          {
            messageId: "not_found_param_chain_with_suggestions",
            data: {
              param: "unknownParam",
              firstFunc: "wrapper",
              secondFunc: "handler", // ✅ Fixed: Now correctly reports 'handler' as the function that rejects the parameter
              available: "id, name",
            },
          },
        ],
      },
    ],
  },
);
