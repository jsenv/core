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

See alo:
https://stackoverflow.com/questions/28028297/js-window-history-delete-a-state
https://developer.mozilla.org/en-US/docs/Web/API/History
*/

import { createCancellationSource, isCancelError } from "@jsenv/cancellation"

export const createRouter = (
  navigate,
  {
    onstart = () => {},
    oncancel = () => {},
    onfail = (navigation, error) => {
      throw error
    },
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

      if (currentNavigation) {
        // this allow a navigate() call to know we don't care anymore about its result
        currentNavigation.cancel(`navigating to ${destinationUrl}`)
      }
      currentNavigation = navigation

      // replace an history entry (initial navigation)
      if (type === "replace") {
        windowHistory.replaceState(
          { position: browserHistoryPosition, state: browserHistoryState },
          "",
          destinationUrl,
        )
      }
      // create immediatly a new entry in the history (clik on a link)
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
          return
        }
      }

      onstart(navigation)

      let page
      try {
        cancellationToken.throwIfRequested() // can happen if onstart calls cancel right away
        page = await navigate(navigation)
        cancellationToken.throwIfRequested()
      } catch (navigationError) {
        if (isCancelError(navigationError)) {
          oncancel(navigation, navigationError)
          return
        }
        status = "failed"
        onfail(navigation, navigationError)
        return
      }
      status = "completed"
      applicationHistoryPosition = browserHistoryPosition
      applicationHistoryState = browserHistoryState
      applicationUrl = browserUrl
      oncomplete(navigation, page)
    }

    navigation.start = start

    return navigation
  }

  const launchCurrentUrl = () => {
    const navigation = createNavigation({
      type: "replace",
      event: { type: "initial-navigation" },
      destinationHistoryPosition: initialHistoryPosition,
      destinationHistoryState: initialHistoryState,
      destinationUrl: initialUrl,
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
    launchCurrentUrl,
    navigateToUrl,
  }
}
