export function complexFunction({ required, config, list }) {
  console.log("Complex function with:", required, config, list);

  // Handle nested config
  if (config && config.nested) {
    console.log("Nested config enabled");
  }

  // Process list
  if (Array.isArray(list)) {
    console.log("Processing list of", list.length, "items");
  }

  return {
    result: "processed",
    required,
    configApplied: Boolean(config),
    itemCount: list ? list.length : 0,
  };
}
