import { createPreference } from "../util/preferences.js"

const animationPreference = createPreference("animation")

export const renderToolbarAnimation = () => {
  const animCheckbox = document.querySelector("#toggle-anims")
  animCheckbox.checked = getAnimationPreference()
  animCheckbox.onchange = () => {
    setAnimationPreference(animCheckbox.checked)
    onPreferenceChange(animCheckbox.checked)
  }
  onPreferenceChange()

  // enable toolbar transition only after first render
  setTimeout(() => {
    document.querySelector("#toolbar").setAttribute("data-animate", "")
  })
}

const onPreferenceChange = (value = getAnimationPreference()) => {
  if (value) {
    enableAnimation()
  } else {
    disableAnimation()
  }
}

const getAnimationPreference = () => (animationPreference.has() ? animationPreference.get() : true)

const setAnimationPreference = (value) => animationPreference.set(value)

const enableAnimation = () => {
  document.documentElement.removeAttribute("data-animation-disabled")
}

const disableAnimation = () => {
  document.documentElement.setAttribute("data-animation-disabled", "")
}
