import htmlText from "./whatever.html"

const div = document.createElement("div")
div.innerHTML = htmlText
while (div.firstChild) {
  document.body.appendChild(div.firstChild)
}

export { htmlText }

export const innerText = document.querySelector("button").innerText
