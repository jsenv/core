import { renderToolbar } from "./toolbar.js"
import { onNavigatePage } from "./page.js"
import { onNavigateFilelist } from "./filelist.js"

export const installNavigation = () => {
  handleLocation()
  window.onpopstate = handleLocation
}

let currentRoute = null

const handleLocation = async () => {
  if (currentRoute) {
    const cleanupRoute = await currentRoute.promise
    if (typeof cleanupRoute === "function") {
      await cleanupRoute()
    }
  }
  const routeNavigationPromise = navigate()
  currentRoute = {
    promise: routeNavigationPromise,
  }
}

const navigate = () => {
  const fileRelativeUrl = document.location.pathname.slice(1)
  renderToolbar(fileRelativeUrl)

  if (fileRelativeUrl) {
    return onNavigatePage(fileRelativeUrl)
  }
  return onNavigateFilelist()
}
