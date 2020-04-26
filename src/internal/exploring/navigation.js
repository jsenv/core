import { renderToolbar } from "./toolbar.js"
import { pageFileList } from "./page-file-list.js"
import { pageFileExecution } from "./page-file-execution.js"

const pageCandidates = [pageFileList, pageFileExecution]

const LOADER_FADING_DURATION = 300

const defaultPageResult = {
  title: "", // no title,
  element: document.querySelector("[data-page=default]"),
  onleave: ({ page, pageLoader }) => {
    pageLoader.style.backgroundColor = page === pageFileList ? "#1f262c" : "white"
  },
}

const pageContainer = document.querySelector("#page")
const pageLoader = document.querySelector("#page-loader")

export const installNavigation = () => {
  const defaultRoute = {
    event: { type: "default" }, // there is no real event that lead to this route
    url: "", // no url for this route it's an abstract route
    name: "default",
    ...defaultPageResult,
  }

  let currentRoute = defaultRoute
  let currentNavigation

  const handleNavigation = async (event) => {
    // always rerender toolbar
    const fileRelativeUrl = document.location.pathname.slice(1)
    renderToolbar(fileRelativeUrl)

    const nextRoute = getNextRoute(event)

    if (nextRoute.url === currentRoute.url) {
      // if the location does not change what does it means, for now I don't know
      // let's just apply everything as usual (it will reload the page)
    }

    if (currentNavigation) {
      currentNavigation.cancel(nextRoute)
    }

    currentNavigation = navigate(currentRoute, nextRoute)
    await currentNavigation
    currentNavigation = undefined
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

const getNextRoute = (event) => {
  const url = String(document.location)
  const page = pageCandidates.find(({ match }) => match({ url, event }))

  return {
    event,
    url,
    ...page,
  }
}

const navigate = async (route, nextRoute) => {
  let canceled = false
  const cancelCallbacks = []

  const cancel = (...args) => {
    if (canceled) return
    console.log(`cancel navigation from ${route.name} to ${nextRoute.name}`)
    canceled = true
    cancelCallbacks.forEach((callback) => {
      callback(...args)
    })
  }

  const addCancelCallback = (callback) => {
    cancelCallbacks.push(callback)
  }

  const promise = (async () => {
    console.log(`leave ${route.name}`)
    if (route.onleave) {
      try {
        route.onleave({ ...nextRoute, pageLoader })
      } catch (e) {
        console.error(`error in route.onleave: ${e.stack}`)
      }
    }

    // while loading we will keep current page elements in the DOM
    // so that the page dimensions are preserved

    // make them able to interact using an absolute div on top of them
    console.log("loader fade-in start")
    pageLoader.style.display = "block"
    pageLoader.style.pointerEvents = "auto"
    const pageLoaderFadeinAnimation = pageLoader.animate(
      [
        {
          opacity: 0,
        },
        {
          opacity: 1,
        },
      ],
      {
        duration: LOADER_FADING_DURATION,
      },
    )
    addCancelCallback(() => {
      pageLoaderFadeinAnimation.cancel()
      pageContainer.style.visibility = "visible"
    })
    const pageLoaderFadeinFinished = animationToFinished(pageLoaderFadeinAnimation)
    pageLoaderFadeinFinished.then(() => {
      if (canceled) return
      console.log(`loader fade-in end -> hide ${route.name} page elements`)
      // hide current page elements (don't use display none to keep their influence on page dimensions)
      pageContainer.style.visibility = "hidden"
    })

    console.log(`navigate to ${nextRoute.name}`)
    const navigationResult = await nextRoute.navigate()
    Object.assign(nextRoute, navigationResult)
    console.log(`navigation to ${nextRoute.name} done`)
    if (canceled) return

    await pageLoaderFadeinFinished
    if (canceled) return

    // inject next page element
    pageContainer.innerHTML = ""
    if (nextRoute.element) {
      pageContainer.appendChild(nextRoute.element)
    }
    console.log(`replace ${route.name} elements with ${nextRoute.name} page elements`)
    pageContainer.style.visibility = "visible"
    pageLoader.style.pointerEvents = "none"
    console.log(`loader fadeout start`)
    const pageLoaderFadeoutAnimation = pageLoader.animate(
      [
        {
          opacity: 1,
        },
        {
          opacity: 0,
        },
      ],
      {
        duration: LOADER_FADING_DURATION,
      },
    )
    addCancelCallback(() => {
      pageLoaderFadeoutAnimation.cancel()
    })
    const pageLoaderFadeoutFinished = animationToFinished(pageLoaderFadeoutAnimation)
    pageLoaderFadeoutFinished.then(() => {
      if (canceled) return
      console.log(`loader fadeout done -> hide loader`)
      pageLoader.style.display = "none"
    })
  })()

  promise.cancel = cancel
  return promise
}

const animationToFinished = (animation) => {
  return new Promise((resolve) => {
    animation.onfinish = resolve
  })
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
