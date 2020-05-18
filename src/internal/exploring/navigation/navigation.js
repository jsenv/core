import { setStyles } from "../util/dom.js"
import { fadeIn, fadeOut, transit } from "../util/animation.js"
import { renderToolbar } from "../toolbar/toolbar.js"
import { getAnimationPreference } from "../toolbar/toolbar-animation.js"
import { pageErrorNavigation } from "../page-error-navigation/page-error-navigation.js"
import { fileListRoute } from "../page-file-list/page-file-list.js"
import { fileExecutionRoute } from "../page-file-execution/page-file-execution.js"
import { createApplicationHistory } from "./application-history.js"

export const installNavigation = () => {
  const pageContainer = document.querySelector("#page")
  const loaderBox = document.querySelector("#page-loader-box")
  const pageLoaderFading = transit(
    {
      "#page-loader": {
        visibility: "hidden",
        background: "rgba(0,0,0,0)",
      },
    },
    {
      "#page-loader": {
        visibility: "visible",
        background: "rgba(0,0,0,0.4)",
      },
    },
    { duration: 300 },
  )
  const defaultActivePage = {
    title: document.title,
    element: document.querySelector('[data-page="default"]'),
  }
  let pageLoaderFadeinPromise

  const applicationHistory = createApplicationHistory([fileListRoute, fileExecutionRoute], {
    activePage: defaultActivePage,
    errorService: pageErrorNavigation,
    onstart: (attempt) => {
      // attention! si rendertoolbar se connecte a l'event source il faut
      // qu'il switch de connection si le fichier change
      // et qu'il ne se déco/reco pas si on appel 2 fois la fonction sur le mem fichier
      renderToolbar(attempt)
      preparePageDeactivation(attempt)
    },
    oncancel: (attempt) => {
      renderToolbar(attempt.activeAttempt || attempt)
      reactivatePage(attempt)
    },
    onerror: (attempt, error) => {
      // maybe we should somehow rerender toolbar to some state because
      // the error might have put it into a incorrect state
      reactivatePage(attempt)
      throw error
    },
    activatePage: async (attempt, page) => {
      await preparePageActivation(attempt, page)
      if (attempt.cancellationToken.cancellationRequested) {
        return
      }
      animatePageReplacement(attempt, page).then(() => {
        if (attempt.cancellationToken.cancellationRequested) {
          return
        }
        deactivatePage(attempt)
      })
    },
  })

  let loaderBoxTimeout
  const prepareShowingLoader = () => {
    loaderBoxTimeout = setTimeout(() => {
      loaderBox.setAttribute("data-animate", "")
      loaderBox.setAttribute("data-visible", "")
    }, 2000)
  }
  const hideLoader = () => {
    loaderBox.removeAttribute("data-animate")
    loaderBox.removeAttribute("data-visible")
    clearTimeout(loaderBoxTimeout)
  }

  const startLoadingNewPage = (attempt) => {
    pageLoaderFadeinPromise = pageLoaderFading.play()
    if (!getAnimationPreference()) {
      pageLoaderFading.finish()
    }
    document.querySelector("#page-loader a").onclick = (clickEvent) => {
      return attempt.cancel(clickEvent)
    }
    hideLoader()
    attempt.cancellationToken.register(() => {
      hideLoader()
    })
    prepareShowingLoader()
  }

  const stopsLoadingNewPage = () => {
    pageLoaderFading.reverse()
    if (!getAnimationPreference()) {
      pageLoaderFading.finish()
    }
  }

  const preparePageDeactivation = async (attempt) => {
    const { activePage } = attempt
    startLoadingNewPage(attempt)
    addBlurFilter(activePage.element)

    const { animateLeaving = () => {} } = activePage
    animateLeaving(attempt)
  }

  const reactivatePage = (attempt) => {
    const { activePage } = attempt
    stopsLoadingNewPage()
    hideLoader()
    removeBlurFilter(activePage.element)
  }

  const preparePageActivation = async (
    { cancellationToken },
    { title, element, prepareEntrance = () => {}, effect = () => {} },
  ) => {
    setStyles(element, { display: "none" })
    pageContainer.appendChild(element)

    await prepareEntrance()

    if (cancellationToken.cancellationRequested) {
      element.parentNode.removeChild(element)
      return
    }

    hideLoader()

    const cancelEffect = effect()
    if (typeof cancelEffect === "function") {
      cancellationToken.register(cancelEffect)
    }

    if (title) {
      document.title = title
    }
  }

  const animatePageReplacement = async (
    { cancellationToken, activePage, browserHistoryEntry },
    newPage,
  ) => {
    pageLoaderFadeinPromise.then(() => {
      stopsLoadingNewPage()
    })

    const currentPageElement = activePage.element
    const newPageElement = newPage.element

    const pageContainerRect = currentPageElement.getBoundingClientRect()
    setStyles(currentPageElement, {
      position: "absolute",
      left: `${0}px`,
      top: `${0}px`,
      height: `${pageContainerRect.height}px`,
      width: `${pageContainerRect.width}px`,
    })
    setStyles(newPageElement, {
      position: "relative", // to be sure it's above page element
      display: "block",
    })
    setTimeout(() => {
      window.scrollTo(browserHistoryEntry.scroll.x, browserHistoryEntry.scroll.y)
    })
    const currentPageElementFadeout = fadeOut(currentPageElement, {
      cancellationToken,
      duration: getAnimationPreference() ? 300 : 0,
    })
    const newPageElementFadein = fadeIn(newPageElement, {
      cancellationToken,
      duration: getAnimationPreference() ? 300 : 0,
    })

    return Promise.all([currentPageElementFadeout, newPageElementFadein])
  }

  const deactivatePage = (attempt) => {
    const { activePage } = attempt
    const activePageElement = activePage.element
    activePageElement.parentNode.removeChild(activePageElement)

    const { onceleft = () => {} } = activePage
    onceleft()
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
    applicationHistory.pushState(null, aElement.href, clickEvent)
  }
  document.addEventListener("click", onclick)

  applicationHistory.replaceState()

  return () => {
    document.removeEventListener("click", onclick)
  }
}

const addBlurFilter = (element) => {
  element.style.filter = `url(#better-blur)`
}

const removeBlurFilter = (element) => {
  element.style.filter = "none"
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
