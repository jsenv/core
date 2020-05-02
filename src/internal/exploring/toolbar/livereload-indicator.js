import { toggleTooltip, removeAutoShowTooltip, autoShowTooltip } from "./tooltip.js"

export const applyLivereloadIndicator = (
  state = "default",
  { connect, abort, disconnect, reconnect } = {},
) => {
  const buttonLivereloadIndicator = document.querySelector("#button-livereload-indicator")
  const buttonVariant = buttonLivereloadIndicator
    .querySelector(`[data-variant="${state}"]`)
    .cloneNode(true)
  const variantContainer = buttonLivereloadIndicator.querySelector("[data-variant-container]")
  variantContainer.innerHTML = ""
  variantContainer.appendChild(buttonVariant)

  buttonLivereloadIndicator.querySelector(".button-content").onclick = () => {
    toggleTooltip(buttonLivereloadIndicator)
  }

  if (state === "off") {
    buttonVariant.querySelector("a").onclick = connect
  } else if (state === "connecting") {
    buttonVariant.querySelector("a").onclick = abort
  } else if (state === "connected") {
    removeAutoShowTooltip(buttonLivereloadIndicator)
    buttonVariant.querySelector("a").onclick = disconnect
  } else if (state === "disconnected") {
    autoShowTooltip(buttonLivereloadIndicator)
    buttonVariant.querySelector("a").onclick = reconnect
  }
}
