import {
  animationsAreEnabled,
  enableAnimations,
  disableAnimations,
} from "../core/toolbar_animation.js"

export const renderToolbarAnimationSetting = () => {
  const animCheckbox = document.querySelector("#toggle-anims")
  animCheckbox.checked = animationsAreEnabled()
  animCheckbox.onchange = () => {
    if (animCheckbox.checked) {
      enableAnimations()
    } else {
      disableAnimations()
    }
  }
  // enable toolbar transition only after first render
  setTimeout(() => {
    document.querySelector("#toolbar").setAttribute("data-animate", "")
  })
}
