import { toggleTooltip } from "./tooltip.js"

export const applyExecutionIndicator = (state = "default", duration) => {
  const buttonExecutionIndicator = document.querySelector("#button-execution-indicator")
  const variant = buttonExecutionIndicator
    .querySelector(`[data-variant="${state}"]`)
    .cloneNode(true)
  const variantContainer = buttonExecutionIndicator.querySelector("[data-variant-container]")
  variantContainer.innerHTML = ""
  variantContainer.appendChild(variant)

  buttonExecutionIndicator.querySelector(".button-content").onclick = () => {
    toggleTooltip(buttonExecutionIndicator)
  }

  if (state === "loading") {
  } else if (state === "success") {
    buttonExecutionIndicator.querySelector(
      ".tooltip",
    ).textContent = `Execution completed in ${duration}ms`
  } else if (state === "failure") {
    buttonExecutionIndicator.querySelector(
      ".tooltip",
    ).textContent = `Execution failed in ${duration}ms`
  }
}
