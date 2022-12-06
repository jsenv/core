import {
  notificationsEnabledSignal,
  notificationAPIDetected,
  enableNotifications,
  disableNotifications,
  requestPermission,
} from "../../core/toolbar_notification.js"
import { enableVariant } from "../variant.js"

export const renderToolbarNotificationSetting = () => {
  if (!notificationAPIDetected) {
    applyNotificationNotAvailableEffects()
    return
  }
  updatePermission()
}

const updatePermission = () => {
  const notifPermission = Notification.permission
  if (notifPermission === "default") {
    applyNotificationDefaultEffects()
    return
  }
  if (notifPermission === "denied") {
    applyNotificationDeniedEffects()
    return
  }
  if (notifPermission === "granted") {
    applyNotificationGrantedEffects()
    return
  }
}

const notifCheckbox = document.querySelector("#toggle_notifs")

const applyNotificationNotAvailableEffects = () => {
  const notifSetting = document.querySelector(".settings_notification")
  notifSetting.setAttribute("data-disabled", "true")
  notifSetting.setAttribute(
    "title",
    `Notification not available in the browser`,
  )
  notifCheckbox.disabled = true
}
const applyNotificationDefaultEffects = () => {
  applyNotificationNOTGrantedEffects()
  const notifSetting = document.querySelector(".settings_notification")
  notifSetting.removeAttribute("data-disabled")
  notifSetting.removeAttribute("title")
}
const applyNotificationDeniedEffects = () => {
  applyNotificationNOTGrantedEffects()
  const notifSetting = document.querySelector(".settings_notification")
  notifSetting.setAttribute("data-disabled", "true")
  notifSetting.setAttribute("title", `Notification denied`)
}
const applyNotificationGrantedEffects = () => {
  enableVariant(document.querySelector(".notification_text"), {
    notif_granted: "yes",
  })
  notifCheckbox.disabled = false
  notifCheckbox.checked = notificationsEnabledSignal.value
  notifCheckbox.onchange = () => {
    if (notifCheckbox.checked) {
      enableNotifications()
    } else {
      disableNotifications()
    }
  }
}
const applyNotificationNOTGrantedEffects = () => {
  enableVariant(document.querySelector(".notification_text"), {
    notif_granted: "no",
  })
  notifCheckbox.disabled = true
  notifCheckbox.checked = false
  document.querySelector("a.request_notification_permission").onclick = () => {
    requestPermission().then(() => {
      enableNotifications()
      updatePermission()
    })
  }
}
