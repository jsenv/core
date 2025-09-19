// Mock createAction for testing
export function createAction(
  callback,
  { name, compute, meta, dataEffect, completeSideEffect, ...otherOptions } = {},
) {
  // Accept various options like name, compute, meta, etc.
  return {
    callback,
    name,
    compute,
    meta,
    dataEffect,
    completeSideEffect,
    ...otherOptions,
  };
}
