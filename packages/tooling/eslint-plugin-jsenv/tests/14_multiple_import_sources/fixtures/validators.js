// Data validation utilities
export function validateEmail({ email }) {
  return email.includes("@");
}

export function validateData({ data, schema }) {
  return typeof data === "object" && schema;
}
