export const createPreference = (name) => {
  return {
    has: () => localStorage.hasOwnProperty(name),
    get: () =>
      localStorage.hasOwnProperty(name) ? JSON.parse(localStorage.getItem(name)) : undefined,
    set: (value) => localStorage.setItem(name, JSON.stringify(value)),
  }
}
