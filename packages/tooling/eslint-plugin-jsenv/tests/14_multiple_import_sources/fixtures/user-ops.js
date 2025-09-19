// User operations
export function createUser({ name, email, role }) {
  return { id: Date.now(), name, email, role };
}

export function updateUser({ id, updates }) {
  return { id, ...updates, updatedAt: new Date() };
}
