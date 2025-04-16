export const markAsInternalError = (error) => {
  Object.defineProperty(error, "__INTERNAL_ERROR__", {
    configurable: true,
    writable: true,
    value: true,
  });
  return error;
};
