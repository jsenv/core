import { loadExploringConfig } from "./util.js"
import { fetchUsingXHR } from "../fetchUsingXHR.js"

const mainElement = document.querySelector("main")

const resizeInput = (input) => {
  if (input.value.length > 40) {
    input.style.width = "40ch"
  } else {
    input.style.width = `${input.value.length}ch`
  }
}

const openFile = (aElement) => {
  // remove overflow X on body
  document.documentElement.style.overflow = "hidden"

  // put the file name in the input in the toolbar
  const input = document.querySelector(".fileName")
  input.value = aElement.innerText
  resizeInput(input)

  // hide the input for now
  const fileInput = document.querySelector(".fileName")
  fileInput.style.opacity = "0"

  // get positions of input in toolbar and aElement
  const inputPosition = fileInput.getBoundingClientRect()
  console.log("inputPosition", inputPosition)
  const position = aElement.getBoundingClientRect()
  console.log("position", position)

  // clone aElement and style it
  const copy = aElement.cloneNode(true)
  aElement.parentNode.insertBefore(copy, aElement)
  copy.style.position = "absolute"
  copy.style.overflow = "hidden"
  copy.style.textOverflow = "ellipsis"

  // define final position of new element and the duration
  const translate = `translate(${inputPosition.left - position.left}px, ${
    inputPosition.top - position.top + 2
  }px)`
  const duration = 700

  // animate new element
  copy.animate(
    [
      {
        transform: "translate(0px, 2px)",
        color: "#e7f2f3",
        fontSize: "13px",
        height: "13px",
        width: "100%",
      },
      { width: "100%", offset: 0.9 },
      { transform: translate, color: "#cecece", fontSize: "15px", height: "15px", width: "40ch" },
    ],
    {
      duration,
      fill: "forwards",
      easing: "ease-in-out",
    },
  )

  // after the animation is done, remove copy and show file input in toolbar
  setTimeout(() => {
    fileInput.style.opacity = "1"
    copy.style.display = "none"
    document.documentElement.style.overflow = "unset"
  }, duration)
}

export const onNavigateFilelist = async () => {
  const { projectDirectoryUrl, explorableConfig } = await loadExploringConfig()

  document.title = `${projectDirectoryUrl}`
  // it would be great to have a loading step in the html display at this point
  mainElement.innerHTML = ""

  const fileListPageElement = document.querySelector(`[data-page="fileList"`).cloneNode(true)

  // explorable section
  // const titleElement = fileListPageElement.querySelector("h2")
  // titleElement.innerHTML = projectDirectoryUrl

  const response = await fetchUsingXHR(`/explorables`, {
    method: "POST",
    body: JSON.stringify(explorableConfig),
    headers: {
      "x-jsenv-exploring": "1",
    },
  })
  const files = await response.json()

  const ul = fileListPageElement.querySelector("ul")
  ul.innerHTML = files.map((file) => `<li><a href="${file}">${file}</a></li>`).join("")
  // ul.querySelectorAll("a").forEach((aElement) => {
  //   aElement.onclick = () => openFile(aElement)
  // })

  mainElement.appendChild(fileListPageElement)
}
