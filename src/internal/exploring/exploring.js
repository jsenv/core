import { installNavigation } from "./navigation.js"
import { createHorizontalBreakpoint } from "./responsive.js"

installNavigation()

// example how to use breakpoint
const horizontalBreakpoint = createHorizontalBreakpoint(800)
const handleHorizontalBreakpoint = () => {
  const below = horizontalBreakpoint.isBelow()
  console.log("is below", below)
}
handleHorizontalBreakpoint()
horizontalBreakpoint.changed.listen(handleHorizontalBreakpoint)

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
