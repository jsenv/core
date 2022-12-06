import { signal, effect } from "@preact/signals"

export const animationsEnabledSignal = signal()
export const enableAnimations = () => {
  animationsEnabledSignal.value = true
}
export const disableAnimations = () => {
  animationsEnabledSignal.value = false
}

effect(() => {
  const animationsEnabled = animationsEnabledSignal.value
  if (animationsEnabled) {
    document.documentElement.removeAttribute("data-animation-disabled")
  } else {
    document.documentElement.setAttribute("data-animation-disabled", "")
  }
})
