import cssText from "./style.css"

const style = document.createElement("style")
style.innerText = cssText
document.head.appendChild(style)

export { cssText }

export default getComputedStyle(document.body).backgroundColor
