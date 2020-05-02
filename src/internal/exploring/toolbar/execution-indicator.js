import { toggleTooltip } from "./tooltip.js"

export const applyExecutionIndicator = (state = "default", duration) => {
  const executionIndicator = document.querySelector("#execution-indicator")
  const variant = executionIndicator.querySelector(`[data-variant="${state}"]`).cloneNode(true)
  const variantContainer = executionIndicator.querySelector("[data-variant-container]")
  variantContainer.innerHTML = ""
  variantContainer.appendChild(variant)

  executionIndicator.querySelector(".button-content").onclick = () => {
    toggleTooltip(executionIndicator)
  }

  if (state === "loading") {
  } else if (state === "success") {
    executionIndicator.querySelector(
      ".tooltip",
    ).textContent = `Execution completed in ${duration}ms`
  } else if (state === "failure") {
    executionIndicator.querySelector(".tooltip").textContent = `Execution failed in ${duration}ms`
  }
}
