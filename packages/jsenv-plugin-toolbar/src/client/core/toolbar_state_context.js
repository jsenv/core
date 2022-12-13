export const stateFromLocalStorage = localStorage.hasOwnProperty(
  "jsenv_toolbar",
)
  ? JSON.parse(localStorage.getItem("jsenv_toolbar"))
  : {}
