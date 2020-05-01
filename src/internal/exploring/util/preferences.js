export const createPreference = (name) => {
  return {
    has: () => localStorage.hasOwnProperty(name),
    get: () => readPreference(name),
    set: (value) => writePreference(name, value),
  }
}

const writePreference = (name, value) => {
  localStorage.setItem(name, JSON.stringify(value))
}

const readPreference = (name) => {
  return localStorage.hasOwnProperty(name) ? JSON.parse(localStorage.getItem(name)) : undefined
}
