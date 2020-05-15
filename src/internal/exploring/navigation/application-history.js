import { createCancellationSource, createOperation, isCancelError } from "@jsenv/cancellation"
import { createLogger } from "@jsenv/logger"
import { getDocumentScroll } from "../util/dom.js"

export const createApplicationHistory = (
  services,
  {
    logLevel = "warn",
    activePage,
    fallbackService = {
      activate: () => {},
    },
    errorService,
    onstart,
    oncancel,
    onerror = ({ result }) => {
      throw result
    },
    activatePage,
    oncomplete = () => {},
  },
) => {
  const logger = createLogger({ logLevel })
  const browserHistory = window.history
  browserHistory.scrollRestoration = "manual"
  const firstHistoryEntry = browserHistory.state
    ? browserHistoryStateToHistoryEntry(browserHistory.state)
    : {
        position: browserHistory.length - 1,
        scroll: getDocumentScroll(),
        state: null,
        url: document.location.href,
      }
  let browserHistoryEntry = firstHistoryEntry
  // application is nowhere, it will try to synchronize with browserHistoryEntry
  let applicationHistoryEntry = {
    position: -1,
    data: undefined,
    url: undefined,
  }

  logger.debug("first history entry", firstHistoryEntry)

  const getState = () => browserHistoryEntry.state

  const pushState = (state, url = document.location.href, event) => {
    browserHistoryEntry.scroll = getDocumentScroll()
    browserHistory.replaceState(historyEntryToBrowserHistoryState(browserHistoryEntry), "")
    browserHistoryEntry = {
      position: browserHistoryEntry.position + 1,
      scroll: browserHistoryEntry.scroll,
      state,
      url,
    }
    browserHistory.pushState(historyEntryToBrowserHistoryState(browserHistoryEntry), "", url)
    logger.debug(`attempt to go to ${browserHistoryEntry.position}`)
    return synchronizeApplication(event)
  }

  const replaceState = (state, url = document.location.href, event) => {
    browserHistoryEntry = {
      position: browserHistoryEntry.position,
      scroll: getDocumentScroll(),
      state,
      url,
    }
    browserHistory.replaceState(historyEntryToBrowserHistoryState(browserHistoryEntry), "", url)
    logger.debug(`attempt to replace ${browserHistoryEntry.position}`)
    return synchronizeApplication(event)
  }

  let currentAttempt
  const canceledByCurrentAttempt = (value) => value === currentAttempt

  let activeAttempt
  let activeService
  const synchronizeApplication = async (event) => {
    // attempt to synchronize application history entry with browser history entry
    const attemptCancellationSource = createCancellationSource()
    const cancellationToken = attemptCancellationSource.token
    const attempt = {
      event,
      browserHistoryEntry,
      applicationHistoryEntry,
      activeAttempt,
      activeService,
      activePage,
      url: browserHistoryEntry.url,
      cancel: attemptCancellationSource.cancel,
      cancellationToken,
      getState,
      replaceState,
      pushState,
    }
    let status = "pending"
    let cancelReason
    let error
    let page

    const previousCurrentAttempt = currentAttempt
    currentAttempt = attempt
    if (previousCurrentAttempt) {
      logger.debug(
        `cancel attempt to go to ${attemptToString(
          previousCurrentAttempt,
        )} because of ${attemptToString(attempt)}`,
      )
      previousCurrentAttempt.cancel(attempt)
    }

    // coté navigation je voudrais savoir que la navigation a été cancel par ce popstate
    // je peux pas juste ignorer
    // par contre j'ai pas besoin d'update la page ni rien
    if (
      event &&
      event.type === "popstate" &&
      browserHistoryEntry.position === applicationHistoryEntry.position
    ) {
      // no need to ask for application to synchronize with this state
      // because application is already on that state
      // non pas vraiment il faudrait plutot cancel avant meme de start non ?
      logger.debug(
        `application and browser in sync on ${browserHistoryEntry.position} -> keep application as it is`,
      )
      return attempt
    }

    const activateService = async (service) => {
      const page = await createOperation({
        cancellationToken,
        start: async () => service.activate(attempt),
      })
      await createOperation({
        cancellationToken,
        start: () => activatePage(attempt, page),
      })
      return page
    }

    let service = services.find((service) => service.match(browserHistoryEntry)) || fallbackService
    /*
      We don't use page.onstatechange anywhere
      the idea is that not everything should show the page loader when it occurs.
      A page might want to handle the state change by itself
      In that case we would call onstatechange
      Bit in that case the page would like to have its own
      oncancel, onerror ? in that case the page should try/catch
      and listen cancellationToken it would have everything
      to decide what to do
    */
    // if (service === activeService && activePage && activePage.onstatechange) {
    //   // en cas d'erreur oui on veut aller sur la page d'erreur ?
    //   // non ici on veut ptet un onerror pour la page
    //   // et meme un oncancel
    //   // et onstatechange devrait ptet s'appeler différement
    //   activePage.onstatechange()
    // }

    onstart(attempt)

    try {
      page = await activateService(service)
    } catch (e) {
      if (isCancelError(e)) {
        status = "canceled"
        cancelReason = e.reason
      } else if (errorService) {
        try {
          service = errorService
          page = await activeService(errorService)
        } catch (errorServiceError) {
          if (isCancelError(errorServiceError)) {
            status = "canceled"
            cancelReason = e.reason
          } else {
            errorServiceError.originalError = e
            status = "errored"
            error = e
          }
        }
      }
    }
    // attempt settled it's not the current attempt anymore
    if (attempt === currentAttempt) {
      currentAttempt = undefined
    }

    if (status === "canceled") {
      if (canceledByCurrentAttempt(cancelReason)) {
        // do not do history.go because
        // we have canceled the current attempt
        // by creating a new one
        // the history conceptually looks like [A, Bcancelled, C]
        // B was not handled by let's go to C immediatly
      } else {
        const movement =
          attempt.applicationHistoryEntry.position - attempt.browserHistoryEntry.position

        if (movement) {
          logger.debug(`${attemptToString(attempt)} canceled -> history.go(${movement})`)
          browserHistory.go(movement)
        } else {
          logger.debug(`${attemptToString(attempt)} canceled`)
        }
      }
      oncancel(attempt, cancelReason)
      return attempt
    }

    logger.debug(`application updated to ${attemptToString(attempt)}`)
    // here we know the application is in sync with browser
    // otherwise attempt would have been canceled
    applicationHistoryEntry = browserHistoryEntry
    if (activeAttempt) {
      logger.debug(
        `cleanup ${attemptToString(activeAttempt)} because of ${attemptToString(attempt)}`,
      )
      activeAttempt.cancel(attempt)
    }
    activeAttempt = attempt
    activeService = service
    const previousPage = activePage
    activePage = page
    if (status === "errored") {
      onerror(attempt, error)
      return attempt
    }
    status = "done"
    oncomplete(attempt, page, previousPage)
    return attempt
  }

  window.onpopstate = (popstateEvent) => {
    const { state } = popstateEvent
    browserHistoryEntry = browserHistoryStateToHistoryEntry(state)
    synchronizeApplication(popstateEvent)
  }

  return {
    getState,
    pushState,
    replaceState,
    canceledByCurrentAttempt,
  }
}

const attemptToString = ({ browserHistoryEntry }) => {
  return `${browserHistoryEntry.position} ${browserHistoryEntry.url}`
}

const browserHistoryStateToHistoryEntry = ({ position, scroll, state }) => {
  return {
    position,
    scroll,
    state,
    url: document.location.href,
  }
}

const historyEntryToBrowserHistoryState = ({ position, scroll, state }) => {
  return {
    position,
    scroll,
    state,
  }
}
