import { renderToolbar } from "./toolbar.js"
import { navigateFileList } from "./page-file-list.js"
import { navigateFileExecution } from "./page-file-execution.js"

const navigationCandidates = [navigateFileList, navigateFileExecution]

export const installNavigation = () => {
  const pageContainer = document.querySelector("main")

  const defaultRoute = {
    url: "", // no url for this route it's an abstract route
    navigation: {
      backgroundColor: "white",
    },
    page: {
      title: "", // no title,
      element: document.querySelector("[data-page=default]"),
    },
  }

  let currentRoute = defaultRoute

  const handleNavigation = async (event) => {
    // always rerender toolbar
    const fileRelativeUrl = document.location.pathname.slice(1)
    renderToolbar(fileRelativeUrl)

    const nextRoute = {
      url: String(document.location),
      event,
    }

    const navigation = firstNavigation(navigationCandidates, nextRoute)
    nextRoute.navigation = navigation

    if (nextRoute.url === currentRoute.url) {
      // if the location does not change what does it means, for now I don't know
    }
    if (currentRoute.page.onleave) {
      currentRoute.page.onleave(nextRoute)
    }

    // remove current page elements
    pageContainer.innerHTML = ""
    // while page is loading we should make sure the new page background color will be transitionned
    // once ready

    // ici navigation peut définir un backgroundColor
    // on sait alors qu'on passe d'un background a un autre
    const page = await navigation.render()
    nextRoute.page = page

    if (page.element) {
      pageContainer.appendChild(page.element)
    }
    currentRoute = nextRoute
  }

  handleNavigation({
    type: "load",
  })
  window.onpopstate = () => {
    handleNavigation({
      type: "popstate",
    })
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
    window.history.pushState({}, "", aElement.href)
    handleNavigation(clickEvent)
  }
  document.addEventListener("click", onclick)
  return () => {
    document.removeEventListener("click", onclick)
  }
}

const firstNavigation = (navigationCandidates, ...args) => {
  let i = 0
  while (i < navigationCandidates.length) {
    const navigationCandidate = navigationCandidates[i]
    i++
    const returnValue = navigationCandidate(...args)

    if (returnValue !== null && typeof returnValue === "object") {
      return returnValue
    }
  }
  return null
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
