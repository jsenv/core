export const paramsFromParentWindow = {}
const searchParams = new URLSearchParams(window.location.search)
searchParams.forEach((value, key) => {
  paramsFromParentWindow[key] = value === "" ? true : value
})

export const parentWindowReloader = window.parent.__reloader__
