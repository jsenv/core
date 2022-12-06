import { createPreference } from "./preferences.js"

export const notificationAPIDetected = typeof window.Notification === "function"

const arrayOfOpenedNotifications = []
const notificationPreference = createPreference("notification")
export const notificationsAreEnabled = () => {
  return notificationPreference.has() ? notificationPreference.get() : true
}
export const enableNotifications = () => {
  notificationPreference.set(true)
}
export const disableNotifications = () => {
  notificationPreference.set(false)
  // slice because arrayOfOpenedNotifications can be mutated while looping
  arrayOfOpenedNotifications.slice().forEach((notification) => {
    notification.close()
  })
}

export const notifyExecutionResult = (
  executedFileRelativeUrl,
  execution,
  previousExecution,
) => {
  const notificationEnabled = notificationsAreEnabled()
  if (!notificationEnabled) return

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

let permission = "default"

export const notify = notificationAPIDetected
  ? async (
      title,
      { clickToFocus = false, clickToClose = false, ...options } = {},
    ) => {
      if (permission !== "granted") {
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

let requestPromise
export const requestPermission = notificationAPIDetected
  ? async () => {
      if (requestPromise) return requestPromise
      requestPromise = Notification.requestPermission()
      permission = await requestPromise
      requestPromise = undefined
      return permission
    }
  : () => Promise.resolve("default")
