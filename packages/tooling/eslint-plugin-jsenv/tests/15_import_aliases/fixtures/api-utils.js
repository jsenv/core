// API utilities with common function names that might need aliases
export function createResource({ type, data }) {
  return { id: Date.now(), type, data };
}

export function updateResource({ id, changes }) {
  return { id, changes, updated: true };
}

export function deleteResource({ id }) {
  return { deleted: true, id };
}
