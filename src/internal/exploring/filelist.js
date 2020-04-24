import { loadExploringConfig } from "./util.js"
import { fetchUsingXHR } from "../fetchUsingXHR.js"
import { showToolbar, hideToolbar } from "./toolbar.js"

const mainElement = document.querySelector("main")

export const onNavigateFilelist = async () => {
  const { projectDirectoryUrl, explorableConfig } = await loadExploringConfig()

  document.title = `${projectDirectoryUrl}`
  // it would be great to have a loading step in the html display at this point
  mainElement.innerHTML = ""

  const configurationPageElement = document
    .querySelector(`[data-page="configuration"`)
    .cloneNode(true)

  // explorable section
  // const titleElement = configurationPageElement.querySelector("h2")
  // titleElement.innerHTML = projectDirectoryUrl

  const response = await fetchUsingXHR(`/explorables`, {
    method: "POST",
    body: JSON.stringify(explorableConfig),
    headers: {
      "x-jsenv-exploring": "1",
    },
  })
  const files = await response.json()

  const ul = configurationPageElement.querySelector("ul")
  ul.innerHTML = files.map((file) => `<li><a href="/${file}">${file}</a></li>`).join("")

  // settings section
  const toolbarInput = configurationPageElement.querySelector("#toggle-toolbar")
  toolbarInput.onchange = () => {
    if (toolbarInput.checked) {
      showToolbar()
    } else {
      hideToolbar()
    }
  }

  mainElement.appendChild(configurationPageElement)
}
