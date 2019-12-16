import cssText from "./style.css"

const style = document.createElement("style")
style.innerText = cssText
document.head.appendChild(style)

export { cssText }

export const bodyBackgroundColor = getComputedStyle(document.body).backgroundColor
