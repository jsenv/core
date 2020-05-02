import { toggleTooltip, removeAutoShowTooltip, autoShowTooltip } from "./tooltip.js"

export const applyLivereloadIndicator = (
  state = "default",
  { connect, abort, disconnect, reconnect } = {},
) => {
  const livereloadIndicator = document.querySelector("#livereload-indicator")
  const buttonVariant = livereloadIndicator
    .querySelector(`[data-variant="${state}"]`)
    .cloneNode(true)
  const variantContainer = livereloadIndicator.querySelector("[data-variant-container]")
  variantContainer.innerHTML = ""
  variantContainer.appendChild(buttonVariant)

  livereloadIndicator.querySelector("button").onclick = () => {
    toggleTooltip(livereloadIndicator)
  }

  if (state === "off") {
    buttonVariant.querySelector("a").onclick = connect
  } else if (state === "connecting") {
    buttonVariant.querySelector("a").onclick = abort
  } else if (state === "connected") {
    removeAutoShowTooltip(livereloadIndicator)
    buttonVariant.querySelector("a").onclick = disconnect
  } else if (state === "disconnected") {
    autoShowTooltip(livereloadIndicator)
    buttonVariant.querySelector("a").onclick = reconnect
  }
}
