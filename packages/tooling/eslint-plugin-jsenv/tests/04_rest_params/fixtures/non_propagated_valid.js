// Valid: Rest params not propagated - no-unused-vars should handle these
function localProcessor({ key, ...settings }) {
  console.log(key);
  // settings is not used, but no-unknown-params shouldn't report this
  // because it's not propagated to another function
}

localProcessor({ key: "value", unused1: "test", unused2: "data" });

// Valid: Rest params used locally (not propagated)
function formatData({ format, ...options }) {
  console.log(`Formatting with ${format}`);
  if (options.verbose) {
    console.log("Verbose mode enabled");
  }
  // Direct access to rest params, not propagation
}

formatData({ format: "json", verbose: true, debug: false });
