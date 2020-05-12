/*

This file is meant to allow having on function called navigate that will be in charge
to implement a website navigation.

navigate({
  cancellationToken, // a token cancelled when navigation is no longer needed or navigated away
  event, // the reason we are navigating
  currentUrl, // where are are
  destinationUrl, // where we want to go
})

When navigate resolves website is considered has having navigated successfully to the next url.
(The ui should reflect the destination url).

This file hooks itself into window.popstate and provide two function

- launchCurrentUrl()

This function should be called asap and will perform the initial page navigation.
Meaning navigate gets called with currentHistoryEntry being undefined

- navigateToUrl(url, event)

This function should be called to politely ask to perform a navigation to the given url
after navigationEvent occured (a click on a <a href> for instance).

Every time a navigation is started onstart(navigation) is be called.
you can call navigation.cancel()

When navigate function throw, onerror(navigation, error) is called.

When navigation is cancelled (by you or because an other navigation cancels it)
oncancel(navigation, cancelError) is called.

const route = {
  name: String (optional),
  match: url => Boolean,
  setup: async ({ cancellationToken }, { reload }) => {

  },
  load: async ({ cancellationToken }, { reload, activePage }) => {
    const page = any
    return page
  }
}

See alo:
https://stackoverflow.com/questions/28028297/js-window-history-delete-a-state
https://developer.mozilla.org/en-US/docs/Web/API/History

Alors imaginons qu'un page a deux état:
un avec un contenu ouvert, l'autre avec un contenu fermé
la page devrait alors avoir la possibilité de dire hey je suis ouverte
ou hey je suis fermée et qu'on fasse
pushState('expanded')
pushState('collapsed')
et que la page soit rerender sans transition
mais alors il faut que la page devienne capable de dire hey a cette url c'est moi le boss
(et éventuellement pour des sous urls mais ignorons ça pour le moment)

autrement dit ce module s'est trop concentré sur le cas particulier de jsenv exploring
ou 1 url = 1 state (et state est null)

alors qu'on voudrait pouvoir avoir 1 url = X state
mais cela suppose des changements ici que je ne souhaite pas faire pour le moment puisque
ça convient tres bien a jsenv exploring.

on renommerais ceci en historyNavigation
le but étant en vérité juste de se brancher
sur history.go() et de fournir au user un moyen
de naviguer entre des états de l'appli
*/

import {
  createCancellationSource,
  composeCancellationToken,
  isCancelError,
  createOperation,
} from "@jsenv/cancellation"
import { createLogger } from "@jsenv/logger"

export const createRouter = (
  routes,
  {
    logLevel = "debug",
    activePage,
    fallbackRoute,
    errorRoute,
    onstart = () => {},
    oncancel = () => {},
    onerror = (navigation) => {
      throw navigation.error
    },
    enter = () => {},
    leave = () => {},
    oncomplete = () => {},
  },
) => {
  const logger = createLogger({ logLevel })
  const windowHistory = window.history
  const initialHistoryPosition = windowHistory.state
    ? windowHistory.state.position
    : window.history.length - 1
  const initialHistoryState = windowHistory.state ? windowHistory.state.state : null
  const initialUrl = document.location.href
  let browserHistoryPosition = initialHistoryPosition
  let browserHistoryState = initialHistoryState
  let browserUrl = initialUrl
  let applicationHistoryPosition = initialHistoryPosition
  let applicationHistoryState = initialHistoryState
  let applicationUrl = initialUrl
  let currentRouteCancellationSource
  let currentPageCancellationSource
  let activeRouteCancellationSource
  let activePageCancellationSource
  let activeRoute

  const createNavigation = ({
    type,
    event,
    destinationUrl,
    destinationHistoryPosition,
    destinationHistoryState,
  }) => {
    const externalCancellationSource = createCancellationSource()
    const externalCancellationToken = externalCancellationSource.token
    const routeCancellationSource = createCancellationSource()
    const routeCancellationToken = composeCancellationToken(
      externalCancellationToken,
      routeCancellationSource.token,
    )
    const pageCancellationSource = createCancellationSource()
    const pageCancellationToken = composeCancellationToken(
      routeCancellationToken,
      pageCancellationSource.token,
    )

    const navigation = {
      status: "",
      routeCancellationToken,
      pageCancellationToken,
      cancel: (reason) => {
        navigation.status = "canceled"
        navigation.cancelReason = reason
        externalCancellationSource.cancel(navigation)
      },
      reload: (event = { type: "reload" }) => loadCurrentUrl(event),
      event,
      activePage,
      currentHistoryPosition: applicationHistoryPosition,
      currentHistoryState: applicationHistoryState,
      currentUrl: applicationUrl,
      destinationHistoryPosition,
      destinationHistoryState,
      destinationUrl,
    }

    const start = async () => {
      /*
      a navigation means browser wants to see something that application
      is responsible to show.

      When navigation starts we update
      - browserHistoryPosition
      - browserHistoryState
      - browserUrl
      variables to reflect what browser wants to see

      resolving aysnc navigate means the application is done navigating:
      the ui shows what browser wants to see.
      After resolving we synchronize
      - applicationHistoryPosition
      - applicationHistoryState
      - applicationUrl
      with browser
      */

      navigation.status = "started"
      browserHistoryPosition = destinationHistoryPosition
      browserHistoryState = destinationHistoryState
      browserUrl = destinationUrl

      // replace an history entry (initial navigation or reload)
      if (type === "replace") {
        logger.debug(`replace browser history entry ${browserHistoryPosition} at ${browserUrl}`)
        windowHistory.replaceState(
          { position: browserHistoryPosition, state: browserHistoryState },
          "",
          destinationUrl,
        )
      }
      // create immediatly a new entry in the history (click on a link)
      else if (type === "push") {
        logger.debug(`add browser history entry ${browserHistoryPosition} at ${browserUrl}`)
        windowHistory.pushState(
          { position: browserHistoryPosition, state: browserHistoryState },
          "",
          destinationUrl,
        )
      }
      // restoring an history entry (popstate)
      else if (type === "restore") {
        logger.debug(
          `browser wants to restore ${browserHistoryPosition} at ${browserUrl} and application is on ${applicationHistoryPosition} at ${applicationUrl}`,
        )
        if (browserHistoryPosition === applicationHistoryPosition) {
          logger.debug(`no need to restore ${browserHistoryPosition}, application is already on it`)
          navigation.status = "ignored"
          applicationHistoryPosition = browserHistoryPosition
          applicationHistoryState = browserHistoryState
          applicationUrl = browserUrl
          // (should happen only when cancelling navigation induced by popstate)
          // attention ceci a pour effet
          return undefined
        }
      }

      const activateRoute = async (navigation) => {
        onstart(navigation)
        routeCancellationToken.throwIfRequested() // in case external cancellation happens during onstart

        if (currentRouteCancellationSource && !navigation.isReload) {
          logger.debug("cancelling current page")
          currentRouteCancellationSource.cancel(navigation)
        }
        if (currentPageCancellationSource) {
          logger.debug("cancelling current route")
          currentPageCancellationSource.cancel(navigation)
        }

        if (!navigation.isReload && navigation.route.setup) {
          currentRouteCancellationSource = routeCancellationSource
          await createOperation({
            cancellationToken: routeCancellationToken,
            start: () => navigation.route.setup(navigation),
          })
        }

        currentPageCancellationSource = pageCancellationSource
        const page = await createOperation({
          cancellationToken: pageCancellationToken,
          start: () => navigation.route.load(navigation),
        })

        await createOperation({
          cancellationToken: pageCancellationToken,
          start: () => enter(page, navigation),
        })

        // remove currentPage from the DOM
        const pageLeft = activePage

        activeRoute = navigation.route
        activePage = page
        navigation.page = page
        navigation.activePage = activePage
        currentRouteCancellationSource = undefined
        currentPageCancellationSource = undefined

        if (activeRouteCancellationSource) {
          if (navigation.isReload) {
            logger.debug("cancelling active page")
            activePageCancellationSource.cancel(navigation)
          } else {
            logger.debug("cancelling active route")
            activeRouteCancellationSource.cancel(navigation)
          }
        }
        activeRouteCancellationSource = routeCancellationSource
        activePageCancellationSource = pageCancellationSource

        if (pageLeft) {
          leave(pageLeft, navigation)
        }

        return page
      }

      const handleCancel = (cancelError) => {
        navigation.status = "canceled"
        navigation.cancelError = cancelError
        const movement = applicationHistoryPosition - browserHistoryPosition
        logger.debug(
          `navigation canceled browser is at ${browserHistoryPosition}, application at ${applicationHistoryPosition}`,
        )
        if (movement) {
          windowHistory.go(movement)
        }
        return oncancel(navigation)
      }

      if (type === "replace" && activeRoute) {
        navigation.route = activeRoute
        navigation.isReload = true
      } else {
        navigation.route =
          routes.find((route) => route.match(navigation.destinationUrl, navigation)) ||
          fallbackRoute
        navigation.isReload = false
      }

      try {
        await activateRoute(navigation)
      } catch (error) {
        if (isCancelError(error)) {
          return handleCancel(error)
        }
        navigation.status = "errored"
        navigation.error = error
        if (!errorRoute) {
          return onerror(navigation)
        }

        try {
          navigation.route = errorRoute
          await activateRoute(navigation)
        } catch (internalError) {
          if (isCancelError(internalError)) {
            return handleCancel(internalError)
          }
          // error while trying to load error route
          // by default we will throw because it's an unexpected internal error.
          navigation.originalError = error
          navigation.error = internalError
          return onerror(navigation)
        }
      }
      if (navigation.status === "ignored") {
        return undefined
      }
      navigation.status = "completed"
      applicationHistoryPosition = browserHistoryPosition
      applicationHistoryState = browserHistoryState
      applicationUrl = browserUrl

      return oncomplete(navigation)
    }

    navigation.start = start

    return navigation
  }

  const loadCurrentUrl = (navigationEvent = { type: "initial-navigation" }) => {
    const navigation = createNavigation({
      type: "replace",
      event: navigationEvent,
      destinationHistoryPosition: applicationHistoryPosition,
      destinationHistoryState: applicationHistoryState,
      destinationUrl: applicationUrl,
    })
    return navigation.start()
  }

  const navigateToUrl = async (destinationUrl, navigationEvent) => {
    const navigation = createNavigation({
      type: "push",
      event: navigationEvent,
      destinationHistoryPosition: applicationHistoryPosition + 1,
      destinationHistoryState: {},
      destinationUrl: new URL(destinationUrl, document.location).href,
    })
    return navigation.start()
  }

  window.onpopstate = async (popstateEvent) => {
    /*
      This navigation occurs because:
      - user click browser back button
      - user click browser forward button
      - programmatic history.back(), history.forward(), history.go()

      In this context the browser already moved in the history (and window.location is up-to-date).
      Assuming we want to cancel history.back() we will call history.forward()
      and when receiving popstate corresponding to that history.forward() we'll compare
      windowHistory.state with our current state and if they are the same
      we don't need to naviguate.
    */
    const popstateHistoryEntry = popstateEvent.state
    const destinationHistoryPosition = popstateHistoryEntry.position
    const destinationHistoryState = popstateHistoryEntry.state
    const destinationUrl = document.location.href
    const popstateNavigation = createNavigation({
      type: "restore",
      event: popstateEvent,
      destinationHistoryPosition,
      destinationHistoryState,
      destinationUrl,
    })
    popstateNavigation.start()
  }

  // we could imagine exporting a router.activateRoute
  // that would skip the match part
  // we could have in the ui a page that does not match the browser url
  // just because we can (also might be useful for unit test)

  return {
    loadCurrentUrl,
    navigateToUrl,
  }
}
