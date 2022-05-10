export const isAutoreloadEnabled = () => {
  const value = window.localStorage.getItem("autoreload")
  if (value === "0") {
    return false
  }
  return true
}

export const setAutoreloadPreference = (value) => {
  window.localStorage.setItem("autoreload", value ? "1" : "0")
}
