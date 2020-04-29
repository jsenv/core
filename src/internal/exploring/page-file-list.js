import { loadExploringConfig } from "./util.js"
import { move } from "./animation.js"
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

    cancellationToken.register(async ({ reason }) => {
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
      const fileInput = document.querySelector(".fileName")
      fileInput.value = href
      resizeInput(fileInput)
      // hide the input during animation
      fileInput.style.opacity = "0"
      await move(aElement, fileInput, {
        duration: 700,
        fill: "forwards",
        easing: "ease-in-out",
      })
      fileInput.style.opacity = "1"
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
