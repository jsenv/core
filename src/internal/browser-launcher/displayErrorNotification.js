/* eslint-env browser */
const { Notification } = window

const displayErrorNotificationNotAvailable = () => {}

const displayErrorNotificationImplementation = async (error, { icon } = {}) => {
  const permission = await Notification.requestPermission()

  if (permission === "granted") {
    const notification = new Notification("An error occured", {
      lang: "en",
      body: error.stack,
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
