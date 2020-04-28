import { loadExploringConfig } from "./util.js"
import { fetchUrl } from "./fetching.js"

export const pageFileList = {
  name: "file-list",
  match: () => {
    if (document.location.pathname !== "/") {
      return false
    }
    return true
  },
  navigate: async ({ cancellationToken }) => {
    const { projectDirectoryUrl, explorableConfig } = await loadExploringConfig()

    const fileListElement = document.querySelector(`[data-page="file-list"`).cloneNode(true)

    const response = await fetchUrl(`/explorables`, {
      method: "POST",
      body: JSON.stringify(explorableConfig),
      headers: {
        "x-jsenv-exploring": "1",
      },
    })
    const files = await response.json()

    const ul = fileListElement.querySelector("ul")
    ul.innerHTML = files.map((file) => `<li><a href=${file}>${file}</a></li>`).join("")

    cancellationToken.register(({ reason }) => {
      const { event, url, pageLoader } = reason
      pageLoader.style.backgroundColor = "#1f262c"

      // only if we leave this page because of a click
      // (we could also do the animation on history.back() or history.forward())
      // for now let's ignore
      if (event.type !== "click") {
        return
      }

      const href = new URL(url).pathname.slice(1)
      const aElement = document.querySelector(`a[href="${href}"]`)
      if (!aElement) {
        return
      }

      // remove overflow X on body
      document.documentElement.style.overflow = "hidden"

      // put the file name in the input in the toolbar
      const input = document.querySelector(".fileName")
      input.value = href
      resizeInput(input)

      // hide the input for now
      const fileInput = document.querySelector(".fileName")
      fileInput.style.opacity = "0"

      // get positions of input in toolbar and aElement
      const inputPosition = fileInput.getBoundingClientRect()
      const position = aElement.getBoundingClientRect()

      // clone aElement and style it
      const copy = aElement.cloneNode(true)
      document.body.appendChild(copy)
      copy.style.position = "absolute"
      copy.style.left = position.left
      copy.style.top = position.top
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
          {
            transform: translate,
            color: "#cecece",
            fontSize: "15px",
            height: "15px",
            width: "40ch",
          },
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
        copy.parentNode.removeChild(copy)
        document.documentElement.style.overflow = "unset"
      }, duration)
    })

    return {
      title: projectDirectoryUrl,
      element: fileListElement,
    }
  },
}

const resizeInput = (input) => {
  if (input.value.length > 40) {
    input.style.width = "40ch"
  } else {
    input.style.width = `${input.value.length}ch`
  }
}
