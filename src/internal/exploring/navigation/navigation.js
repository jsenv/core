import {
  createCancellationSource,
  isCancelError,
  composeCancellationToken,
} from "@jsenv/cancellation"
import { moveElement } from "../util/util.js"
import { transit } from "../util/animation.js"
import { renderToolbar } from "../toolbar/toolbar.js"
import { pageErrorNavigation } from "../page-error-navigation/page-error-navigation.js"
import { pageFileList } from "../page-file-list/page-file-list.js"
import { pageFileExecution } from "../page-file-execution/page-file-execution.js"

const pageCandidates = [pageErrorNavigation, pageFileList, pageFileExecution]

const defaultPage = {
  name: "default",
  navigate: ({ navigationCancellationToken }) => {
    // cancellationToken.register(({ reason }) => {
    //   const { page, pageLoader } = reason
    //   pageLoader.style.backgroundColor = page === pageFileList ? "#1f262c" : "white"
    // })
    return {
      title: document.title,
      load: () => {
        return {
          pageElement: document.querySelector("[data-page=default]"),
        }
      },
    }
  },
}

const pageContainer = document.querySelector("#page")
const nextPageContainer = document.querySelector("#next-page")
const pageLoader = document.querySelector("#page-loader")
const pageLoaderFadein = transit(
  {
    "#page-loader": { visibility: "hidden", opacity: 0 },
  },
  {
    "#page-loader": { visibility: "visible", opacity: 0.2 },
  },
  { duration: 300 },
)
// we should also animate eventual page size transition
// (if the page becomes bigger smaller, the height of #page changes)
// if so let's handle in a separate transition for now
const pageContainerFadeout = transit(
  {
    "#page": { opacity: 1 },
  },
  {
    "#page": { opacity: 0 },
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
    ...defaultPage.navigate({ cancellationToken: navigationCancellationSource.token }),
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
    const navigationCancellationToken = navigationCancellationSource.token

    try {
      await performNavigation(currentRoute, nextRoute, {
        navigationCancellationToken,
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

const performNavigation = async (route, nextRoute, { navigationCancellationToken }) => {
  let fadeinPromise = pageLoaderFadein.play()
  let page
  let loadAttempt
  let previousPageCleanupElementAfterRemove = () => {}
  const loadPage = async ({ reloadFlag } = {}) => {
    if (loadAttempt) {
      loadAttempt.cancel({ reloadFlag })
    }
    const loadCancellationSource = createCancellationSource()
    const loadCancellationToken = composeCancellationToken(
      navigationCancellationToken,
      loadCancellationSource.token,
    )
    loadAttempt = {
      cancel: loadCancellationSource.cancel,
    }
    const {
      pageElement,
      mutatePageElementBeforeDisplay,
      cleanupPageElementAfterRemove = () => {},
    } = await page.load({
      loadCancellationToken,
    })
    if (loadCancellationToken.cancellationRequested) {
      return
    }

    // replace current page with new page
    nextPageContainer.appendChild(pageElement)
    if (mutatePageElementBeforeDisplay) {
      await mutatePageElementBeforeDisplay()
    }
    // remove loader because it's no longer needed
    pageLoaderFadein.reverse()
    if (loadCancellationToken.cancellationRequested) {
      return
    }
    // fadeout current page
    await pageContainerFadeout.play()
    if (loadCancellationToken.cancellationRequested) {
      pageContainerFadeout.reverse()
      return
    }
    // replace current page with new page
    pageContainer.innerHTML = ""
    previousPageCleanupElementAfterRemove()
    moveElement(pageElement, nextPageContainer, pageContainer)
    previousPageCleanupElementAfterRemove = cleanupPageElementAfterRemove
    // fadein new page
    pageContainerFadeout.reverse()
  }

  const reloadPage = ({ reloadFlag = true } = {}) => {
    fadeinPromise = pageLoaderFadein.play()
    return loadPage({
      reloadFlag,
    })
  }

  page = await nextRoute.navigate({
    ...nextRoute,
    navigationCancellationToken,
    reloadPage,
  })

  if (navigationCancellationToken.cancellationRequested) {
    pageLoaderFadein.reverse()
    return
  }
  await fadeinPromise

  if (page.title) {
    document.title = page.title
  }
  await loadPage()
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
