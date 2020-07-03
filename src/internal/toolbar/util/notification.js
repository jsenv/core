import { createPreference } from "./preferences.js"

const notificationPreference = createPreference("notification")

export const notificationAvailable = typeof window.Notification === "function"

export const getNotificationPreference = () =>
  notificationPreference.has() ? notificationPreference.get() : true

export const setNotificationPreference = (value) => notificationPreference.set(value)

const arrayOfOpenedNotifications = []
export const registerNotifications = () => {
  const notifCheckbox = document.querySelector("#toggle-notifs")
  notifCheckbox.checked = getNotificationPreference()
  notifCheckbox.onchange = () => {
    setNotificationPreference(notifCheckbox.checked)
    if (notifCheckbox.checked) {
      // request permission early
      // especially useful on firefox where you can request permission
      // only inside a user generated event such as this onchange handler
      requestPermission()
    } else {
      // slice because arrayOfOpenedNotifications can be mutated while looping
      arrayOfOpenedNotifications.slice().forEach((notification) => {
        notification.close()
      })
    }
  }
}

export const notifyFileExecution = (execution, previousExecution) => {
  const notificationEnabled = getNotificationPreference()
  if (!notificationEnabled) return

  const { fileRelativeUrl } = execution
  const notificationOptions = {
    lang: "en",
    icon: getFaviconHref(),
    clickToFocus: true,
    clickToClose: true,
  }

  if (execution.result.status === "errored") {
    if (previousExecution) {
      if (previousExecution.result.status === "completed") {
        notify("Broken", {
          ...notificationOptions,
          body: `${fileRelativeUrl} execution now failing.`,
        })
      } else {
        notify("Still failing", {
          ...notificationOptions,
          body: `${fileRelativeUrl} execution still failing.`,
        })
      }
    } else {
      notify("Failing", {
        ...notificationOptions,
        body: `${fileRelativeUrl} execution failed.`,
      })
    }
  } else if (previousExecution && previousExecution.result.status === "errored") {
    notify("Fixed", {
      ...notificationOptions,
      body: `${fileRelativeUrl} execution fixed.`,
    })
  }
}

const getFaviconHref = () => {
  const link = document.querySelector('link[rel="icon"]')
  return link ? link.href : undefined
}

const notify = notificationAvailable
  ? async (title, { clickToFocus = false, clickToClose = false, ...options } = {}) => {
      const permission = await requestPermission()
      if (permission === "granted") {
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
      return null
    }
  : () => {}

let permissionPromise
const requestPermission = notificationAvailable
  ? async () => {
      if (permissionPromise) return permissionPromise
      permissionPromise = Notification.requestPermission()
      const permission = await permissionPromise
      permissionPromise = undefined
      return permission
    }
  : () => Promise.resolve("denied")
