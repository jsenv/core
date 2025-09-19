export function createUser({ name, email }) {
  console.log("Creating user:", name, email);
  return { id: Date.now(), name, email };
}
