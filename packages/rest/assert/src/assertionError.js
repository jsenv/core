export const isAssertionError = (value) =>
  value && typeof value === "object" && value.name === "AssertionError";

export const createAssertionError = (message) => {
  const error = new Error(message);
  error.name = "AssertionError";
  return error;
};
