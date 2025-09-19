import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
  },
});

ruleTester.run(
  "no-unknown-params - simple object parameters",
  noUnknownParamsRule,
  {
    valid: [
      {
        name: "Object.keys() usage accepts any property via rest parameter",
        code: `const stringifyAttributes = (object) => {
  let string = "";
  Object.keys(object).forEach((key) => {
    const value = object[key];
    if (value === undefined) return;
    if (string !== "") string += " ";
    string += \`\${key}=\${value}\`;
  });
  return string;
};

const createHtmlNode = ({ tagName, children = "", ...rest }) => {
  const html = \`<\${tagName} \${stringifyAttributes(rest)}>\${children}</\${tagName}>\`;
  return html;
};

// This should be valid because stringifyAttributes uses the object parameter
createHtmlNode({ tagName: "div", src: "image.jpg", alt: "Image", className: "test" });`,
      },
      {
        name: "Simple console.log usage accepts any property",
        code: `const logObject = (obj) => {
  console.log(obj);
};

const processData = ({ id, ...metadata }) => {
  logObject(metadata);
};

// Should be valid because logObject uses the obj parameter
processData({ id: 1, name: "test", category: "data", extra: "info" });`,
      },
      {
        name: "Parameter used in expression accepts any property",
        code: `const processConfig = (config) => {
  return "Config: " + config;
};

const setup = ({ env, ...options }) => {
  return processConfig(options);
};

// Should be valid because processConfig uses the config parameter
setup({ env: "prod", debug: true, cache: false, timeout: 5000 });`,
      },
      {
        name: "Parameter used in conditional accepts any property",
        code: `const validateOptions = (opts) => {
  if (opts) {
    return true;
  }
  return false;
};

const initialize = ({ mode, ...settings }) => {
  return validateOptions(settings);
};

// Should be valid because validateOptions references the opts parameter
initialize({ mode: "test", verbose: true, strict: false });`,
      },
      {
        name: "Parameter used with property access accepts any property",
        code: `const getTitle = (data) => {
  return data.title || "Default";
};

const render = ({ type, ...props }) => {
  return getTitle(props);
};

// Should be valid because getTitle accesses properties on the data parameter
render({ type: "page", title: "Home", description: "Welcome", meta: {} });`,
      },
    ],
    invalid: [
      {
        name: "Unused parameter should still report errors for unknown properties",
        code: `const ignoreParam = (unused) => {
  return "fixed result";
};

const process = ({ name, ...rest }) => {
  return ignoreParam(rest);
};

const directCall = ({ id }) => {
  console.log(id);
};

// This should error because directCall doesn't accept 'name' property
directCall({ id: 1, name: "invalid" });`,
        output: `const ignoreParam = (unused) => {
  return "fixed result";
};

const process = ({ name, ...rest }) => {
  return ignoreParam(rest);
};

const directCall = ({ id }) => {
  console.log(id);
};

// This should error because directCall doesn't accept 'name' property
directCall({ id: 1 });`,
        errors: [
          {
            messageId: "not_found_param",
            data: { param: "name", func: "directCall" },
            type: "Property",
          },
        ],
      },
    ],
  },
);

console.log("✅ Simple object parameters tests completed!");
