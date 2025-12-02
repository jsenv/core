import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("no-unknown-params - external functions", noUnknownParamsRule, {
  valid: [
    {
      name: "External function with rest parameters accepts any property",
      options: [{ reportAllUnknownParams: true }],
      code: `const processData = ({ type, ...options }) => {
  // console.log is an external function - we don't have its source code
  // When rest parameters are passed to external functions, assume all properties are valid
  console.log(type, options);
};

// Should be valid because console.log is external and receives the rest parameter
processData({ type: "user", name: "John", age: 30, email: "john@example.com", extra: "data" });`,
    },
    {
      name: "External function called directly with object accepts any property",
      options: [{ reportAllUnknownParams: true }],
      code: `const handleUser = (userData) => {
  // JSON.stringify is external - assume it accepts any object structure
  return JSON.stringify(userData);
};

const createUser = ({ id, ...profile }) => {
  return handleUser(profile);
};

// Should be valid because handleUser passes to JSON.stringify (external)
createUser({ id: 1, name: "Alice", email: "alice@example.com", role: "admin", department: "IT" });`,
    },
    {
      name: "External function with Object methods accepts any property",
      options: [{ reportAllUnknownParams: true }],
      code: `const serializeConfig = (config) => {
  // Object.assign is external
  return Object.assign({}, config, { timestamp: Date.now() });
};

const setupApp = ({ env, ...settings }) => {
  return serializeConfig(settings);
};

// Should be valid because Object.assign is external and accepts any object
setupApp({ env: "prod", debug: true, cache: false, timeout: 5000, retries: 3 });`,
    },
    {
      name: "External library function accepts any configuration",
      options: [{ reportAllUnknownParams: true }],
      code: `const configureLibrary = (options) => {
  // Assume this is an external library function we don't have source for
  return someLibrary.configure(options);
};

const initializeApp = ({ name, ...config }) => {
  return configureLibrary(config);
};

// Should be valid because someLibrary.configure is external
initializeApp({ name: "MyApp", theme: "dark", animations: true, debugging: false });`,
    },
  ],
  invalid: [
    {
      name: "Internal function still validates parameters correctly",
      options: [{ reportAllUnknownParams: true }],
      code: `// This is an internal function - we have its source code
const processUser = ({ name, age }) => {
  console.log(name, age);
};

const handleData = ({ type, ...userData }) => {
  // Even though userData comes from rest, processUser is internal
  // so we can validate its parameters
  return processUser(userData);
};

// This should error because processUser doesn't accept 'email'
handleData({ type: "user", name: "John", age: 30, email: "john@example.com" });`,
      output: `// This is an internal function - we have its source code
const processUser = ({ name, age }) => {
  console.log(name, age);
};

const handleData = ({ type, ...userData }) => {
  // Even though userData comes from rest, processUser is internal
  // so we can validate its parameters
  return processUser(userData);
};

// This should error because processUser doesn't accept 'email'
handleData({ type: "user", name: "John", age: 30 });`,
      errors: [
        {
          messageId: "not_found_param_chain_with_suggestions",
          data: {
            param: "email",
            firstFunc: `"handleData" params`,
            secondFunc: `"processUser" params`,
            available: "type, name, age",
          },
          type: "Property",
        },
      ],
    },
  ],
});

console.log("✅ External functions tests completed!");
