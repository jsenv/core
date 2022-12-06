import { sendEventToParent } from "./parent_window_communication.js"

const stateFromLocalStorage = localStorage.hasOwnProperty("jsenv_toolbar")
  ? JSON.parse(localStorage.getItem("jsenv_toolbar"))
  : {}

export const toolbarState = {
  opened: false,
  theme: "dark",
  animationsEnabled: false,
  notificationsEnabled: false,
  ...stateFromLocalStorage,
  ready: false,
}

const stateChangeCallbackSet = new Set()
export const onStateChange = (callback) => {
  stateChangeCallbackSet.add(callback)
  return () => {
    stateChangeCallbackSet.delete(callback)
  }
}

export const effect = (callback) => {
  callback(toolbarState)
  onStateChange(callback)
}

export const onStateTransition = (predicate, callback) => {
  return onStateChange((state, prevState) => {
    if (typeof predicate === "string") {
      if (prevState[predicate] !== state[predicate]) {
        callback(state, prevState)
      }
    } else if (predicate(prevState, state)) {
      callback(state)
    }
  })
}

export const updateToolbarState = (properties) => {
  const previousState = { ...toolbarState }
  Object.assign(toolbarState, properties)
  stateChangeCallbackSet.forEach((callback) => {
    callback(toolbarState, previousState)
  })
  localStorage.set("jsenv_toolbar", JSON.stringify(toolbarState))
  if (!toolbarState.ready) {
    return
  }
  sendEventToParent("toolbar_state_change", toolbarState)
}
