import { renderToolbar } from "./toolbar.js"
import { onNavigateFileExecution } from "./file-execution.js"
import { onNavigateFileList } from "./file-list.js"

export const installNavigation = () => {
  const pageContainer = document.querySelector("main")

  const defaultRoute = {
    url: "", // no url for this route it's an abstract route
    page: {
      title: "", // no title,
      element: document.querySelector("[data-page=default]"),
    },
  }

  let currentRoute = defaultRoute

  const handleLocation = async () => {
    const nextRoute = {
      url: String(document.location),
    }

    if (nextRoute.url === currentRoute.url) {
      // if the location does not change what does it means, for now I don't know
    }
    if (currentRoute.page.onleave) {
      currentRoute.page.onleave()
    }

    pageContainer.removeChild(currentRoute.page.element)

    const pagePromise = navigate(nextRoute.url)
    const page = await pagePromise
    nextRoute.page = page

    pageContainer.appendChild(nextRoute.page.element)
    currentRoute = nextRoute
  }

  const navigate = () => {
    const fileRelativeUrl = document.location.pathname.slice(1)
    renderToolbar(fileRelativeUrl)

    if (fileRelativeUrl) {
      return onNavigateFileExecution(fileRelativeUrl)
    }
    return onNavigateFileList()
  }

  handleLocation()
  window.onpopstate = () => {
    handleLocation()
  }

  const onclick = (clickEvent) => {
    if (clickEvent.defaultPrevented) {
      return
    }

    if (isClickToOpenTab(clickEvent)) {
      return
    }

    const aElement = clickEventToAElement(clickEvent)
    if (!aElement) {
      return
    }

    if (aElementHasSpecificNavigationBehaviour(aElement)) {
      return
    }

    if (aElement.origin !== window.location.origin) {
      return
    }

    clickEvent.preventDefault()
    // ça ne trigger pas popstate :o
    window.history.pushState({}, "", aElement.href)
  }
  document.addEventListener("click", onclick)
  return () => {
    document.removeEventListener("click", onclick)
  }
}

const isClickToOpenTab = (clickEvent) => {
  if (clickEvent.button !== 0) {
    // Chrome < 55 fires a click event when the middle mouse button is pressed
    return true
  }
  if (clickEvent.metaKey) {
    return true
  }
  if (clickEvent.ctrlKey) {
    return true
  }
  return false
}

const clickEventToAElement = (clickEvent) => {
  const target = clickEvent.target
  let elementOrAncestor = target
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (elementOrAncestor.nodeName === "A") {
      return elementOrAncestor
    }
    elementOrAncestor = elementOrAncestor.parentNode
    if (!elementOrAncestor) {
      return null
    }
  }
}

const aElementHasSpecificNavigationBehaviour = (aElement) => {
  // target="_blank" (open in a new tab)
  if (aElement.target) {
    return true
  }

  // navigator will download the href
  if (aElement.hasAttribute("download")) {
    return true
  }

  // #hash page navigation (scroll to element with this id)
  const { location } = window
  if (
    aElement.origin === location.origin &&
    aElement.pathname === location.pathname &&
    aElement.search
  ) {
    return true
  }

  return false
}
