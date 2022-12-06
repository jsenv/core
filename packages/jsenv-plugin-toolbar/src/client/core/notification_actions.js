import { notificationAPIDetected } from "./notification_context.js"
import { notificationsEnabledSignal } from "./notification_signals.js"

const arrayOfOpenedNotifications = []

export const notify = notificationAPIDetected
  ? async (
      title,
      { clickToFocus = false, clickToClose = false, ...options } = {},
    ) => {
      const notificationsEnabled = notificationsEnabledSignal.value
      if (!notificationsEnabled) {
        return null
      }
      if (Notification.permission !== "granted") {
        return null
      }
      const notification = new Notification(title, options)
      arrayOfOpenedNotifications.push(notification)
      notification.onclick = () => {
        // but if the user navigated inbetween
        // focusing window will show something else
        // in that case it could be great to do something
        // maybe like showing a message saying this execution
        // is no longer visible
        // we could also navigauate to this file execution but
        // there is no guarantee re-executing the file would give same output
        // and it would also trigger an other notification
        if (clickToFocus) window.focus()
        if (clickToClose) notification.close()
      }
      notification.onclose = () => {
        const index = arrayOfOpenedNotifications.indexOf(notification)
        if (index > -1) {
          arrayOfOpenedNotifications.splice(index, 1)
        }
      }
      return notification
    }
  : () => {}

export const closeAllNotifications = () => {
  // slice because arrayOfOpenedNotifications can be mutated while looping
  arrayOfOpenedNotifications.slice().forEach((notification) => {
    notification.close()
  })
}

let requestPromise
export const requestPermission = notificationAPIDetected
  ? async () => {
      if (requestPromise) {
        await requestPromise
        return
      }
      requestPromise = Notification.requestPermission()
      await requestPromise
      requestPromise = undefined
      const permission = Notification.permission
      if (permission === "granted") {
        notificationsEnabledSignal.value = true
      } else {
        notificationsEnabledSignal.value = false
      }
    }
  : () => Promise.resolve()

export const notifyExecutionResult = (
  executedFileRelativeUrl,
  execution,
  previousExecution,
) => {
  const notificationOptions = {
    lang: "en",
    icon: getFaviconHref(),
    clickToFocus: true,
    clickToClose: true,
  }
  if (execution.status === "errored") {
    if (previousExecution) {
      if (previousExecution.status === "completed") {
        notify("Broken", {
          ...notificationOptions,
          body: `${executedFileRelativeUrl} execution now failing.`,
        })
      } else {
        notify("Still failing", {
          ...notificationOptions,
          body: `${executedFileRelativeUrl} execution still failing.`,
        })
      }
    } else {
      notify("Failing", {
        ...notificationOptions,
        body: `${executedFileRelativeUrl} execution failed.`,
      })
    }
  } else if (previousExecution && previousExecution.status === "errored") {
    notify("Fixed", {
      ...notificationOptions,
      body: `${executedFileRelativeUrl} execution fixed.`,
    })
  }
}

const getFaviconHref = () => {
  const link = document.querySelector('link[rel="icon"]')
  return link ? link.href : undefined
}
