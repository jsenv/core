// Intermediate file that re-exports from helper.js
export { processData } from "./helper.js";

// Also define a new function for chaining tests
export function validateUser({ username, email }) {
  console.log("Validating:", username, email);
  return true;
}