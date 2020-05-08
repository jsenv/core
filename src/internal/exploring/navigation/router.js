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

- navigateToUrl(url, state, event)

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
  enter: async ({ cancellationToken, reloadPage }) => {
    const page = {
      title,
      load: async () => {
        const pageView = any
        return pageView
      }
    }
    return page
  }
}

See alo:
https://stackoverflow.com/questions/28028297/js-window-history-delete-a-state
https://developer.mozilla.org/en-US/docs/Web/API/History
*/

import { createCancellationSource, isCancelError } from "@jsenv/cancellation"

export const createRouter = (
  routes,
  {
    fallbackRoute,
    errorRoute,
    onstart = () => {},
    oncancel = () => {},
    onerror = (navigation, error) => {
      throw error
    },
    addPageView,
    removePageView,
    oncomplete = () => {},
  },
) => {
  const windowHistory = window.history
  const initialHistoryPosition = windowHistory.length
  const initialHistoryState = windowHistory.state
  const initialUrl = document.location.href
  let browserHistoryPosition = initialHistoryPosition
  let browserHistoryState = initialHistoryState
  let browserUrl = initialUrl
  let applicationHistoryPosition = initialHistoryPosition
  let applicationHistoryState = initialHistoryState
  let applicationUrl = initialUrl
  let currentNavigation
  let currentPage
  let currentPageView

  const createNavigation = ({
    type,
    event,
    destinationUrl,
    destinationHistoryPosition,
    destinationHistoryState,
  }) => {
    let status = ""
    const navigationCancellationSource = createCancellationSource()
    const cancellationToken = navigationCancellationSource.token

    const cancel = (reason) => {
      if (status === "canceled") {
        return
      }

      /**
      Cancelling a pending navigation induced by popstate means we need to resync
      browser history with the application state

      Cancelling a pending navigation induced by a click on a link means we need to resync
      browser history with the application state

      Cancelling a pending navigation that aimes to replace browser history has no impact
      on browser history it's already in sync with application state
      */
      if (status === "started") {
        const movement = applicationHistoryPosition - browserHistoryPosition
        if (movement) {
          windowHistory.go(movement)
        }
      }

      status = "canceled"
      // cancel is always possible even after complete/fail
      // because it is used to clean up things
      navigationCancellationSource.cancel(reason)
    }

    const navigation = {
      cancellationToken,
      cancel,
      event,
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

      status = "started"
      browserHistoryPosition = destinationHistoryPosition
      browserHistoryState = destinationHistoryState
      browserUrl = destinationUrl

      // replace an history entry (initial navigation or reload)
      if (type === "replace") {
        windowHistory.replaceState(
          { position: browserHistoryPosition, state: browserHistoryState },
          "",
          destinationUrl,
        )
      }
      // create immediatly a new entry in the history (click on a link)
      else if (type === "push") {
        windowHistory.pushState(
          { position: browserHistoryPosition, state: browserHistoryState },
          "",
          destinationUrl,
        )
      }
      // restoring an history entry (popstate)
      else if (type === "restore") {
        if (browserHistoryPosition === applicationHistoryPosition) {
          // (should happen only when cancelling navigation induced by popstate)
          currentNavigation = navigation
          return undefined
        }
      }

      const loadPage = async (page) => {
        const nextPageView = await page.load()

        // if we have a nextPageView but it's no longer needed line below will throw
        // and navigation will be canceled, nextPageView will be ignored
        cancellationToken.throwIfRequested()

        await addPageView(nextPageView, currentPageView, navigation)

        // at this point we put nextPageView in the DOM but it's no longer needed
        // let's remove it from the DOM and throw to cancel the navigation
        if (cancellationToken.cancellationRequested) {
          removePageView(nextPageView)
          cancellationToken.throwIfRequested()
          return undefined
        }

        // remove currentPageView from the DOM and return nextPageView
        // which will become the currentPageView
        removePageView(currentPageView)
        return nextPageView
      }

      const loadRoute = async (route, ...args) => {
        return route.enter(navigation, ...args)
      }

      const callLoadingErrorRouteOnError = async (fn) => {
        try {
          cancellationToken.throwIfRequested()
          const page = await fn()
          cancellationToken.throwIfRequested()
          return page
        } catch (error) {
          if (isCancelError(error)) {
            return oncancel(navigation, error)
          }
          try {
            const errorPage = await loadRoute(errorRoute, error)
            cancellationToken.throwIfRequested()
            return errorPage
          } catch (internalError) {
            if (isCancelError(internalError)) {
              return oncancel(navigation, internalError)
            }
            // error while trying to load error route
            // by default we will throw because it's an unexpected internal error.
            status = "errored"
            return onerror(navigation, internalError)
          }
        }
      }

      if (currentNavigation) {
        /*
        on doit renommer tout ça
        y'a navigationCancellationToken -> on abandonne la navigation completement
        et pageLoadCancellationToken -> on abandonne le chargement de la page
        mais on reste sur la meme route (on reload)
        donc si on est ici par un loadCurrentUrl on cancel que pageLoadCancellationToken
        et sinon on cancel la navigation
        mais en fait chaque navigation a son propre cancellationToken

        je suppose qu'on pourrait réutiliser le cancellationToken de la navigation
        précédente dans le cas dans loadCurrentUrl
        et ne pas le cancel ?
        et comme ça currentNavigation.cancel va cancel l'ancienne et la nouvelle
        tout ça se passe vraiment dans le type === 'replace' && currentPage en gros

        sauf qu'on veut cancel la nav précédente si on fait popstate sur le truc courant ?
        le return undefined va empécher currentNavigation = navigation
        ce qui est pas fou
        */

        // this allow a navigate() call to know we don't care anymore about its result
        currentNavigation.cancel(navigation)
      }
      currentNavigation = navigation

      onstart(navigation)
      // si c'est un replace et qu'on a déja une page on fait direct page.load
      if (type === "replace" && currentPage) {
        currentPageView = await callLoadingErrorRouteOnError(() => {
          return loadPage(currentPage)
        })
      } else {
        currentPageView = await callLoadingErrorRouteOnError(async () => {
          const routeMatching =
            routes.find((route) => route.match(navigation.destinationUrl)) || fallbackRoute
          currentPage = await loadRoute(routeMatching)
          cancellationToken.throwIfRequested()
          return loadPage(currentPage)
        })
      }
      status = "completed"
      applicationHistoryPosition = browserHistoryPosition
      applicationHistoryState = browserHistoryState
      applicationUrl = browserUrl
      return oncomplete(navigation, currentPageView)
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

  const navigateToUrl = async (destinationUrl, destinationHistoryState, navigationEvent) => {
    destinationUrl = new URL(destinationUrl, document.location).href // resolve relative urls
    const navigation = createNavigation({
      type: "push",
      event: navigationEvent,
      destinationHistoryPosition: applicationHistoryPosition + 1,
      destinationHistoryState,
      destinationUrl,
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

  return {
    loadCurrentUrl,
    navigateToUrl,
  }
}
