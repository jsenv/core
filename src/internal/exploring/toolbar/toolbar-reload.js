import { createPreference } from "../util/preferences.js"

const reloadPreference = createPreference("reload")

export const renderToolbarReload = () => {
  const reloadCheckbox = document.querySelector("#toggle-reload")
  reloadCheckbox.checked = getReloadPreference() === "document"
  reloadCheckbox.onchange = () => {
    setReloadPreference(reloadCheckbox.checked ? "document" : "iframe")
  }
}

export const getReloadPreference = () =>
  reloadPreference.has() ? reloadPreference.get() : "document"

export const setReloadPreference = (value) => reloadPreference.set(value)
