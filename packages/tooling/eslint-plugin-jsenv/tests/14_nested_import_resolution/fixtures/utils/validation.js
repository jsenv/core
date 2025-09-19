export function validateUser({ id, email }) {
  console.log("Validating user:", id, email);
  return id && email;
}
