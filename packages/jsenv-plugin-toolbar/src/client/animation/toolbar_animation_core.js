import { toolbarState, updateToolbarState } from "../toolbar_state.js"
import { createPreference } from "../util/preferences.js"

const animationPreference = createPreference("jsenv_toolbar_animation")

export const animationsAreEnabled = () => {
  return toolbarState.animationsEnabled
}

export const enableAnimations = () => {
  updateToolbarState({
    animationsEnabled: true,
  })
  animationPreference.set(true)
  document.documentElement.removeAttribute("data-animation-disabled")
}

export const disableAnimations = () => {
  updateToolbarState({
    animationsEnabled: false,
  })
  animationPreference.set(false)
  document.documentElement.setAttribute("data-animation-disabled", "")
}

updateToolbarState({
  animationsEnabled: animationPreference.has()
    ? animationPreference.get()
    : true,
})
