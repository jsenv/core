/* eslint-env browser */

export const isLivereloadEnabled = () =>
  window.localStorage.hasOwnProperty("livereload")

export const setLivereloadPreference = (value) => {
  window.localStorage.setItem("livereload", JSON.stringify(value))
}
