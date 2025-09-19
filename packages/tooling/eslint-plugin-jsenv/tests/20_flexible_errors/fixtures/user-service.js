export function createUser({ name, email }) {
  console.log("Creating user:", name, email);
  return { id: Date.now(), name, email };
}

export function updateUser({ id, name }) {
  console.log("Updating user:", id, name);
  return { id, name, updatedAt: new Date() };
}

export function deleteUser({ id }) {
  console.log("Deleting user:", id);
  return { deleted: true, id };
}
