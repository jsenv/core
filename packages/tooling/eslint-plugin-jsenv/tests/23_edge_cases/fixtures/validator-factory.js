export function createValidator({ strict }) {
  return function validator(data) {
    console.log("Validating with strict mode:", strict, "data:", data);
    return { valid: true, strict, data };
  };
}
