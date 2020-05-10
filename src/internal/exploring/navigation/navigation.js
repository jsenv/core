/*

- dans router.js test what happens with history.go(0)
if it trigger popstate ensure we behave corretly
otherwise if it's just location.reload() we got nothing to do

*/

import { setStyles } from "../util/dom.js"
import { fadeIn, fadeOut, transit } from "../util/animation.js"
import { renderToolbar } from "../toolbar/toolbar.js"
import { errorNavigationRoute } from "../page-error-navigation/page-error-navigation.js"
import { fileListRoute } from "../page-file-list/page-file-list.js"
import { fileExecutionRoute } from "../page-file-execution/page-file-execution.js"
import { createRouter } from "./router.js"

export const installNavigation = () => {
  const pageContainer = document.querySelector("#page")
  // const pageLoader = document.querySelector("#page-loader")
  const pageLoaderFadein = transit(
    {
      "#page-loader": { visibility: "hidden", opacity: 0 },
    },
    {
      "#page-loader": { visibility: "visible", opacity: 0.4 },
    },
    { duration: 300 },
  )
  const routes = [fileListRoute, fileExecutionRoute]
  let pageLoaderFadeinPromise
  const router = createRouter(routes, {
    activePage: {
      title: document.title,
      element: document.querySelector('[data-page="default"]'),
      // ça serais bien sa voir vers quoi on va comme ça
      // on pourrait mettre un background black si on va vers la page d'index
      // bref pour plus tard ça
    },
    errorRoute: errorNavigationRoute,
    onstart: (navigation) => {
      pageLoaderFadeinPromise = pageLoaderFadein.play()

      // every navigation must render toolbar
      // this function is synchronous it's just ui
      renderToolbar(new URL(navigation.destinationUrl).pathname.slice(1), navigation)

      if (navigation.activePage && navigation.activePage.onleavestart) {
        navigation.activePage.onleavestart(navigation)
      }
    },
    oncancel: () => {
      pageLoaderFadein.reverse()
    },
    onerror: (navigation, error) => {
      pageLoaderFadein.reverse()
      throw error
    },
    enter: async (page, { pageCancellationToken }) => {
      const { effect, title, element, mutateElementBeforeDisplay = () => {} } = page

      const redisplay = setStyles(element, { display: "none" })
      pageContainer.appendChild(element)
      await mutateElementBeforeDisplay()
      // if mutateElementBeforeDisplay and things before it were super fast
      // wait for pageLoader fade in to be done before doing the loader fadeout

      if (pageCancellationToken.cancellationRequested) {
        element.parentNode.removeChild(element)
        return
      }

      if (effect) {
        pageCancellationToken.register(effect())
      }
      if (title) {
        document.title = title
      }

      // show this new page, transition will be handled by leave
      redisplay()
    },
    leave: async (page, { pageCancellationToken, activePage }) => {
      const pageElement = page.element
      const activePageElement = activePage.element

      // if new page is smaller active page can be interacted because pageloader is fadedout ?
      setStyles(pageElement, {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        top: 0,
      })
      activePageElement.style.position = "relative" // to be sure it's above page element
      pageLoaderFadeinPromise.then(() => {
        pageLoaderFadein.reverse()
      })
      const pageElementFadeout = fadeOut(pageElement, {
        cancellationToken: pageCancellationToken,
        duration: 300,
      })
      const activePageElementFadein = fadeIn(activePageElement, {
        cancellationToken: pageCancellationToken,
        duration: 300,
      })

      await Promise.all([pageElementFadeout, activePageElementFadein])

      pageElement.parentNode.removeChild(pageElement)
    },
  })

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
    router.navigateToUrl(aElement.href, clickEvent)
  }
  document.addEventListener("click", onclick)

  // if we cancel this navigation we will just show the default page
  // which is a blank page
  // and reloading the page is the only wait to get this to happen again
  // moreover this function is what we want to call
  // inside file-execution page when we want to re-execute
  router.loadCurrentUrl()

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
