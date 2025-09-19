// Test unknown functions - should be ignored (no errors)

// External/global functions we don't know about
window.someFunction({ a: true, b: false, extra: "unknown" });
document.createElement({ tagName: "div", extra: "properties" });
console.log({ message: "hello", level: "info", extra: "data" });

// Imported functions (we don't have their definitions)
import { externalFunction } from "some-library";
externalFunction({ config: true, options: {}, extra: "params" });

// Functions from other modules
const utils = require("./utils");
utils.doSomething({ input: "data", extra: "values" });

// Method calls on objects
const api = getApiClient();
api.request({ url: "/api", method: "GET", extra: "headers" });

// Functions assigned from elsewhere
const dynamicFunction = getDynamicFunction();
dynamicFunction({ param1: "value", param2: 123, extra: "ignored" });
