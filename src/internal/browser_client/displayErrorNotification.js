/* eslint-env browser */
const { Notification } = window

const displayErrorNotificationNotAvailable = () => {}

const displayErrorNotificationImplementation = (error, { icon } = {}) => {
  if (Notification.permission === "granted") {
    const notification = new Notification("An error occured", {
      lang: "en",
      body: error ? error.stack : "undefined",
      icon,
    })
    notification.onclick = () => {
      window.focus()
    }
  }
}

export const displayErrorNotification =
  typeof Notification === "function"
    ? displayErrorNotificationImplementation
    : displayErrorNotificationNotAvailable
