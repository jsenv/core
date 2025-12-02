import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run("no-unknown-params - rest parameters", noUnknownParamsRule, {
  valid: [
    {
      name: "basic rest parameters accept extra properties",
      options: [{ reportAllUnknownParams: true }],
      code: `const toto = ({ a, ...rest }) => {
  console.log(a, rest);
};
toto({ a: 1, b: 2, c: 3, d: 4 });`,
    },
    {
      name: "rest params propagated to functions that use the properties",
      options: [{ reportAllUnknownParams: true }],
      code: `function processOptions({ mode, ...rest }) {
  return helper({ mode, ...rest });
}

function helper({ mode, debug, verbose }) {
  console.log(mode, debug, verbose);
}

processOptions({ mode: "dev", debug: true, verbose: false });`,
    },
    {
      name: "rest params not propagated (no-unused-vars handles unused rest)",
      options: [{ reportAllUnknownParams: true }],
      code: `function localProcessor({ key, ...settings }) {
  console.log(key);
}

localProcessor({ key: "value", unused1: "test", unused2: "data" });

function formatData({ format, ...options }) {
  console.log(\`Formatting with \${format}\`);
  if (options.verbose) {
    console.log("Verbose mode enabled");
  }
}

formatData({ format: "json", verbose: true, debug: false });`,
    },
    {
      name: "property renaming in destructuring - valid cases",
      options: [{ reportAllUnknownParams: true }],
      code: `const validRename = ({ a: b }) => {
  console.log(b);
};
validRename({ a: true });

const validRenameWithRest = ({ a: b, ...rest }) => {
  console.log(b, rest);
};
validRenameWithRest({ a: true, c: false });

const multipleRename = ({ prop1: x, prop2: y }) => {
  console.log(x, y);
};
multipleRename({ prop1: 1, prop2: 2 });`,
    },
  ],
  invalid: [
    {
      name: "mixed rest and non-rest parameters - extra in non-rest",
      options: [{ reportAllUnknownParams: true }],
      code: `function mixed({ config, ...settings }, { data, meta }) {
  console.log(config, settings, data, meta);
}
mixed(
  { config: "dev", debug: true, cache: false },
  { data: [1, 2, 3], extra: "should error" },
);`,
      output: `function mixed({ config, ...settings }, { data, meta }) {
  console.log(config, settings, data, meta);
}
mixed(
  { config: "dev", debug: true, cache: false },
  { data: [1, 2, 3] },
);`,
      errors: [
        {
          messageId: "not_found_param",
          data: { param: "extra", func: `"mixed" params` },
          type: "Property",
        },
      ],
    },
    {
      name: "rest params propagated but properties unused in chain",
      options: [{ reportAllUnknownParams: true }],
      code: `function initializeApp({ name, ...config }) {
  console.log(\`Starting \${name}\`);
  return setupCore({ ...config });
}

function setupCore({ version }) {
  console.log(\`Version: \${version}\`);
}

initializeApp({ name: "MyApp", version: "1.0", debug: true, timeout: 5000 });

function createUser({ id, ...userInfo }) {
  return saveUser({ id, ...userInfo });
}

function saveUser({ id, name }) {
  console.log(\`Saving user \${id}: \${name}\`);
}

createUser({ id: 1, name: "John", email: "john@example.com", age: 30 });

function processRequest({ method, ...requestData }) {
  return validateRequest({ method, ...requestData });
}

function validateRequest({ method, ...validationData }) {
  return handleRequest({ method, ...validationData });
}

function handleRequest({ method, body }) {
  console.log(\`Handling \${method} with body:\`, body);
}

processRequest({
  method: "POST",
  body: { data: "test" },
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});`,
      output: `function initializeApp({ name, ...config }) {
  console.log(\`Starting \${name}\`);
  return setupCore({ ...config });
}

function setupCore({ version }) {
  console.log(\`Version: \${version}\`);
}

initializeApp({ name: "MyApp", version: "1.0", timeout: 5000 });

function createUser({ id, ...userInfo }) {
  return saveUser({ id, ...userInfo });
}

function saveUser({ id, name }) {
  console.log(\`Saving user \${id}: \${name}\`);
}

createUser({ id: 1, name: "John", age: 30 });

function processRequest({ method, ...requestData }) {
  return validateRequest({ method, ...requestData });
}

function validateRequest({ method, ...validationData }) {
  return handleRequest({ method, ...validationData });
}

function handleRequest({ method, body }) {
  console.log(\`Handling \${method} with body:\`, body);
}

processRequest({
  method: "POST",
  body: { data: "test" },
  timeout: 30000,
});`,
      errors: [
        {
          messageId: "not_found_param_chain_with_suggestions",
          data: {
            param: "debug",
            firstFunc: `"initializeApp" params`,
            secondFunc: `"setupCore" params`,
            available: "name, version",
          },
          type: "Property",
        },
        {
          messageId: "not_found_param_chain_with_suggestions",
          data: {
            param: "timeout",
            firstFunc: `"initializeApp" params`,
            secondFunc: `"setupCore" params`,
            available: "name, version",
          },
          type: "Property",
        },
        {
          messageId: "not_found_param_chain_with_suggestions",
          data: {
            param: "email",
            firstFunc: `"createUser" params`,
            secondFunc: `"saveUser" params`,
            available: "id, name",
          },
          type: "Property",
        },
        {
          messageId: "not_found_param_chain_with_suggestions",
          data: {
            param: "age",
            firstFunc: `"createUser" params`,
            secondFunc: `"saveUser" params`,
            available: "id, name",
          },
          type: "Property",
        },
        {
          messageId: "not_found_param_chain_with_suggestions",
          data: {
            param: "headers",
            firstFunc: `"processRequest" params`,
            secondFunc: `"validateRequest" params`,
            available: "method, body",
          },
          type: "Property",
        },
        {
          messageId: "not_found_param_chain_with_suggestions",
          data: {
            param: "timeout",
            firstFunc: `"processRequest" params`,
            secondFunc: `"validateRequest" params`,
            available: "method, body",
          },
          type: "Property",
        },
      ],
    },
    {
      name: "property renaming in destructuring - invalid cases",
      options: [{ reportAllUnknownParams: true }],
      code: `const invalidRename1 = ({ a: b }) => {
  console.log(b);
};
invalidRename1({ b: true });

const invalidRename2 = ({ a: b }) => {
  console.log(b);
};
invalidRename2({ c: true });

const invalidMultipleRename = ({ prop1: x, prop2: y }) => {
  console.log(x, y);
};
invalidMultipleRename({ x: 1, y: 2 });`,
      output: `const invalidRename1 = ({ a: b }) => {
  console.log(b);
};
invalidRename1({  });

const invalidRename2 = ({ a: b }) => {
  console.log(b);
};
invalidRename2({  });

const invalidMultipleRename = ({ prop1: x, prop2: y }) => {
  console.log(x, y);
};
invalidMultipleRename({ y: 2 });`,
      errors: [
        {
          messageId: "not_found_param",
          data: { param: "b", func: `"invalidRename1" params` },
          type: "Property",
        },
        {
          messageId: "not_found_param",
          data: { param: "c", func: `"invalidRename2" params` },
          type: "Property",
        },
        {
          messageId: "not_found_param",
          data: { param: "x", func: `"invalidMultipleRename" params` },
          type: "Property",
        },
        {
          messageId: "not_found_param",
          data: { param: "y", func: `"invalidMultipleRename" params` },
          type: "Property",
        },
      ],
    },
  ],
});
