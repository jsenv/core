// Minimal debug case - matches real createAction signature
export function createAction(callback, rootOptions = {}) {
  return { callback, ...rootOptions };
}

// Wrapper function - this should accept any param that createAction accepts
function createWrapper({ callback, ...options }) {
  return createAction(callback, { ...options });
}

// This should work - compute is valid for createAction
createWrapper({
  callback: () => {},
  compute: (id) => id, // Should be valid via ...options -> createAction
});
