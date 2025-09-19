export default function defaultHandler(params) {
  // Default function - should not be analyzed by our rule
  console.log("Default handler:", params);
  return params;
}

export function namedFunction({ id, name }) {
  console.log("Named function:", id, name);
  return { id, name, processed: true };
}
