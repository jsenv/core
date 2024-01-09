export const isAssertionError = (value) => {
  if (!value) return false;
  if (typeof value !== "object") return false;
  if (value.name === "AssertionError") return true;
  if (value.name.includes("AssertionError")) return true;
  return false;
};

export const createAssertionError = (message) => {
  const error = new Error(message);
  error.name = "AssertionError";
  return error;
};
