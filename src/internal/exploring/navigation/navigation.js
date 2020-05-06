import { createCancellationSource, isCancelError } from "@jsenv/cancellation"
import { createPromiseAndHooks } from "../util/util.js"
import { transit } from "../util/animation.js"
import { renderToolbar } from "../toolbar/toolbar.js"
import { pageErrorNavigation } from "../page-error-navigation/page-error-navigation.js"
import { pageFileList } from "../page-file-list/page-file-list.js"
import { pageFileExecution } from "../page-file-execution/page-file-execution.js"

const pageCandidates = [pageErrorNavigation, pageFileList, pageFileExecution]

const defaultPage = {
  name: "default",
  naviguate: ({ cancellationToken }) => {
    cancellationToken.register(({ reason }) => {
      const { page, pageLoader } = reason
      pageLoader.style.backgroundColor = page === pageFileList ? "#1f262c" : "white"
    })
    return {
      title: document.title,
      element: document.querySelector("[data-page=default]"),
    }
  },
}

const pageContainer = document.querySelector("#page")
const pageLoader = document.querySelector("#page-loader")
const pageLoaderFading = transit(
  {
    "#page-loader": { visibility: "hidden", opacity: 0 },
    "#page": { visibility: "visible" },
  },
  {
    "#page-loader": { visibility: "visible", opacity: 1 },
    "#page": { visibility: "hidden" },
  },
  { duration: 300 },
)

export const installNavigation = () => {
  let navigationCancellationSource = createCancellationSource()
  const defaultRoute = {
    event: { type: "default" }, // there is no real event that lead to this route
    url: "", // no url for this route it's an abstract route
    page: defaultPage,
    ...defaultPage,
    ...defaultPage.naviguate({ cancellationToken: navigationCancellationSource.token }),
  }
  let currentRoute = defaultRoute

  const handleNavigationEvent = async (event) => {
    // always rerender toolbar
    const fileRelativeUrl = document.location.pathname.slice(1)
    renderToolbar(fileRelativeUrl)

    const url = String(document.location)
    const nextPage = pageCandidates.find(({ match }) => match({ url, event }))
    const nextRoute = {
      event,
      url,
      page: nextPage,
      ...nextPage,
    }

    navigationCancellationSource.cancel({ ...nextRoute, pageLoader })
    navigationCancellationSource = createCancellationSource()
    const cancellationToken = navigationCancellationSource.token

    try {
      await performNavigation(currentRoute, nextRoute, {
        cancellationToken,
      })
    } catch (e) {
      if (isCancelError(e)) return

      // navigation error while navigating to error page
      if (nextPage.name === "error-navigation") throw e

      handleNavigationEvent({
        type: "error-navigation",
        data: {
          route: nextRoute,
          error: e,
        },
      })
      return
    }
    currentRoute = nextRoute
    document.documentElement.setAttribute("data-route", nextRoute.name)
  }

  handleNavigationEvent({
    type: "load",
  })
  window.onpopstate = () => {
    handleNavigationEvent({
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
    handleNavigationEvent(clickEvent)
  }
  document.addEventListener("click", onclick)
  return () => {
    document.removeEventListener("click", onclick)
  }
}

const performNavigation = async (route, nextRoute, { cancellationToken }) => {
  // the only issue with css transition is that when navigation is very fast
  // the opacity transition might feel broken, to be tested

  // while loading we will keep current page elements in the DOM
  // so that the page dimensions are preserved
  document.documentElement.setAttribute("data-route-leaving", "")
  const fadeinPromise = pageLoaderFading.play()
  const mountPromise = createPromiseAndHooks()
  const navigationResult = await nextRoute.navigate({
    ...nextRoute,
    cancellationToken,
    mountPromise,
  })
  Object.assign(nextRoute, navigationResult)
  document.documentElement.removeAttribute("data-route-leaving")
  if (cancellationToken.cancellationRequested) {
    pageLoaderFading.reverse()
    return
  }
  await fadeinPromise

  // inject next page element
  pageContainer.innerHTML = ""
  if (nextRoute.element) {
    pageContainer.appendChild(nextRoute.element)
    mountPromise.resolve()
    if (navigationResult.onmount) {
      navigationResult.onmount()
    }
  }
  if (nextRoute.title) {
    document.title = nextRoute.title
  }

  pageLoaderFading.reverse()
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
