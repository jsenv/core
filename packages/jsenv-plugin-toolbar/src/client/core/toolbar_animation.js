import { toolbarState, updateToolbarState } from "./toolbar_state.js"

export const getAnimationsEnabled = () => {
  return toolbarState.animationsEnabled
}

export const enableAnimations = () => {
  updateToolbarState({
    animationsEnabled: true,
  })
  document.documentElement.removeAttribute("data-animation-disabled")
}

export const disableAnimations = () => {
  updateToolbarState({
    animationsEnabled: false,
  })
  document.documentElement.setAttribute("data-animation-disabled", "")
}
