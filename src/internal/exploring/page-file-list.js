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
    ul.innerHTML = files
      .map((file) => `<li><a class="execution-link" href=${file}>${file}</a></li>`)
      .join("")

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

      // put the file name in the input in the toolbar
      const input = document.querySelector(".fileName")
      input.value = href
      resizeInput(input)

      // hide the input for now
      const fileInput = document.querySelector(".fileName")
      fileInput.style.opacity = "0"

      const fromComputedStyle = window.getComputedStyle(aElement)
      const toComputedStyle = window.getComputedStyle(fileInput)
      // get positions of input in toolbar and aElement
      const fromPosition = aElement.getBoundingClientRect()
      const toPosition = fileInput.getBoundingClientRect()

      // we'll do the animation in a div preventing overflow and pointer events
      const div = document.createElement("div")
      div.style.position = "absolute"
      div.style.left = 0
      div.style.top = 0
      div.style.right = 0
      div.style.bottom = 0
      div.style.overflow = "hidden"
      div.style.pointerEvents = "none"
      // clone aElement and style it
      const copy = aElement.cloneNode(true)
      copy.style.position = "absolute"
      copy.style.left = fromPosition.left
      copy.style.top = fromPosition.top
      copy.style.maxWidth = fromPosition.right - fromPosition.left
      copy.style.overflow = "hidden"
      copy.style.textOverflow = "ellipsis"
      div.appendChild(copy)
      document.body.appendChild(div)

      const toLeft =
        toPosition.left - fromPosition.left - (parseInt(fromComputedStyle.paddingLeft) || 0)
      const toTop =
        toPosition.top - fromPosition.top - (parseInt(fromComputedStyle.paddingTop) || 0)
      // define final position of new element and the duration
      const translate = `translate(${toLeft}px, ${toTop}px)`
      const duration = 700

      // animate new element
      copy.animate(
        [
          {
            transform: "translate(0px, 0px)",
            backgroundColor: fromComputedStyle.backgroundColor,
            color: fromComputedStyle.color,
            fontSize: fromComputedStyle.fontSize,
            height: fromPosition.bottom - fromPosition.top,
            width: "100%",
          },
          {
            transform: translate,
            backgroundColor: toComputedStyle.backgroundColor,
            color: toComputedStyle.color,
            fontSize: toComputedStyle.fontSize,
            height: toPosition.bottom - toPosition.top,
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
        div.parentNode.removeChild(div)
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
