import { updateToolbarState } from "../toolbar_state.js"
import { createPreference } from "../util/preferences.js"

const animationPreference = createPreference("jsenv_toolbar_animation")

export const renderToolbarAnimation = () => {
  const animCheckbox = document.querySelector("#toggle-anims")
  animCheckbox.checked = getAnimationPreference()
  animCheckbox.onchange = () => {
    setAnimationPreference(animCheckbox.checked)
    onPreferenceChange(animCheckbox.checked)
  }
  onPreferenceChange(getAnimationPreference())

  // enable toolbar transition only after first render
  setTimeout(() => {
    document.querySelector("#toolbar").setAttribute("data-animate", "")
  })
}

const onPreferenceChange = (value) => {
  if (value) {
    enableAnimation()
  } else {
    disableAnimation()
  }
  updateToolbarState({
    animationsEnabled: value,
  })
}

const getAnimationPreference = () =>
  animationPreference.has() ? animationPreference.get() : true

const setAnimationPreference = (value) => animationPreference.set(value)

const enableAnimation = () => {
  document.documentElement.removeAttribute("data-animation-disabled")
}

const disableAnimation = () => {
  document.documentElement.setAttribute("data-animation-disabled", "")
}
