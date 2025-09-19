// Debug test to understand current behavior
import { createAction } from "./fixtures/actions.js";

// Simple case that should work
function createWrapper({ callback, ...options }) {
  console.log("wrapper called with:", arguments);
  return createAction(callback, {
    name: "wrapper",
    ...options,
  });
}

// This should be valid but currently fails
createWrapper({
  callback: () => {},
  compute: (id) => id,
});
