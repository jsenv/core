// Demo: File path enhancement in error messages
import { processUser } from "./user-utils.js";

// This should show an error message with the file path
processUser({
  name: "John",
  email: "john@example.com",
  // eslint-disable-next-line jsenv/no-unknown-params
  invalidParam: "This will show where processUser is defined",
});

// Local function for comparison
function localFunction({ name, email }) {
  console.log(name, email);
}

// This should show an error message without file path (local function)
localFunction({
  name: "Jane",
  email: "jane@example.com",
  // eslint-disable-next-line jsenv/no-unknown-params
  localInvalidParam: "This won't show file path",
});
