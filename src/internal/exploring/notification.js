// TODO: take into account notification preference
// export a way to get/set this preference
// add a notification when livereloading event source gets disconnected ?

export const notifyFileExecution = (execution, previousExecution) => {
  const { fileRelativeUrl } = execution
  const notificationOptions = {
    lang: "en",
    // icon: put base64 jsenv icon there
    // notification with the same tag are replaced
    // we'll try to see what makes sense
    // tag: fileRelativeUrl,
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

const notificationAvailable = typeof window.Notification === "function"

const notify = notificationAvailable
  ? async (title, { clickToFocus = false, clickToClose = false, ...options } = {}) => {
      const permission = await requestPermission()
      if (permission === "granted") {
        const notification = new Notification(title, options)
        notification.onclick = () => {
          if (clickToFocus) window.focus()
          if (clickToClose) notification.close()
        }
        return notification
      }
      return null
    }
  : () => {}

const requestPermission = notificationAvailable
  ? async () => {
      const permission = await Notification.requestPermission()
      return permission
    }
  : () => Promise.resolve("denied")
