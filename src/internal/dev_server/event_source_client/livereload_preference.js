/* eslint-env browser */

export const isLivereloadEnabled = () => {
  const value = window.localStorage.getItem("livereload")
  if (value === "0") {
    return false
  }
  return true
}

export const setLivereloadPreference = (value) => {
  window.localStorage.setItem("livereload", value ? "1" : "0")
}
