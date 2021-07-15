import { removeForceHideElement, activateToolbarSection } from "../util/dom.js"
import { enableVariant } from "../variant/variant.js"
import { toggleTooltip } from "../tooltip/tooltip.js"

export const renderCompilationInToolbar = ({ compileInfo }) => {
  // reset file execution indicator ui
  updateCompilationIndicator({ compileInfo })
  removeForceHideElement(document.querySelector("#compile-indicator"))
  activateToolbarSection(document.querySelector("#compile-indicator"))
}

const updateCompilationIndicator = ({ compileInfo } = {}) => {
  const compilationIndicator = document.querySelector("#compile-indicator")
  enableVariant(compilationIndicator, {
    compilation: compileInfo.compileId,
  })
  const variantNode = compilationIndicator.querySelector("[data-when-active]")
  if (variantNode) {
    variantNode.querySelector("button").onclick = () => toggleTooltip(compilationIndicator)
    // const compileDirectoryText = variantNode.querySelector(".tooltip .compile-directory")
    // compileDirectoryText.title = `${compileInfo.outDirectoryRelativeUrl}${compileInfo.compileId}`
    // compileDirectoryText.textContent = compileInfo.compileId

    // TODO: reason should be collected from the result
    // of scanBrowserFeatures() and do its best to describe
    // why the files needs to be compiled
    variantNode.querySelector(".tooltip .reason").textContent = "Unknown reason"
  }
}
