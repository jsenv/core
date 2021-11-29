import { createPreference } from "../util/preferences.js"
import { enableVariant } from "../variant/variant.js"

const notificationAvailable = typeof window.Notification === "function"
const notificationPreference = createPreference("notification")

const arrayOfOpenedNotifications = []
export const renderToolbarNotification = () => {
  const notifCheckbox = document.querySelector("#toggle-notifs")
  if (!notificationAvailable) {
    const notifSetting = document.querySelector(".settings-notification")
    notifSetting.setAttribute("data-disabled", "true")
    notifSetting.setAttribute(
      "title",
      `Notification not available in the browser`,
    )
    notifCheckbox.disabled = true
    return
  }

  const updatePermission = () => {
    if (Notification.permission === "denied") {
      const notifSetting = document.querySelector(".settings-notification")
      notifSetting.setAttribute("data-disabled", "true")
      notifSetting.setAttribute("title", `Notification denied`)
      notifCheckbox.disabled = true
      return
    }

    notifCheckbox.checked = getNotificationPreference()
    notifCheckbox.onchange = () => {
      setNotificationPreference(notifCheckbox.checked)
      if (!notifCheckbox.checked) {
        // slice because arrayOfOpenedNotifications can be mutated while looping
        arrayOfOpenedNotifications.slice().forEach((notification) => {
          notification.close()
        })
      }
    }
    const notifPermission = Notification.permission
    enableVariant(document.querySelector(".notification-text"), {
      notif_permission: notifPermission === "granted" ? "yes" : "no",
    })
    if (notifPermission === "default") {
      document.querySelector("a.request_notification_permission").onclick =
        () => {
          requestPermission().then(() => {
            updatePermission()
          })
        }
    }
  }
  updatePermission()
}

export const notifyExecutionResult = (
  executedFileRelativeUrl,
  execution,
  previousExecution,
) => {
  const notificationEnabled = getNotificationPreference()
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

const getNotificationPreference = () =>
  notificationPreference.has() ? notificationPreference.get() : true

const setNotificationPreference = (value) => notificationPreference.set(value)

const getFaviconHref = () => {
  const link = document.querySelector('link[rel="icon"]')
  return link ? link.href : undefined
}

let permission = "default"

const notify = notificationAvailable
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
const requestPermission = notificationAvailable
  ? async () => {
      if (requestPromise) return requestPromise
      requestPromise = Notification.requestPermission()
      permission = await requestPromise
      requestPromise = undefined
      return permission
    }
  : () => Promise.resolve("default")
