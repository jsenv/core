import { installNavigation } from "./navigation/navigation.js"

installNavigation()

// enable toolbar transition only after first render
setTimeout(() => {
  document.querySelector("#toolbar").style.transitionDuration = "300ms"
})

// handle data-last-interaction attr on html (focusring)
window.addEventListener("mousedown", (mousedownEvent) => {
  if (mousedownEvent.defaultPrevented) {
    return
  }
  document.documentElement.setAttribute("data-last-interaction", "mouse")
})
window.addEventListener("touchstart", (touchstartEvent) => {
  if (touchstartEvent.defaultPrevented) {
    return
  }
  document.documentElement.setAttribute("data-last-interaction", "mouse")
})
window.addEventListener("keydown", (keydownEvent) => {
  if (keydownEvent.defaultPrevented) {
    return
  }
  document.documentElement.setAttribute("data-last-interaction", "keyboard")
})
