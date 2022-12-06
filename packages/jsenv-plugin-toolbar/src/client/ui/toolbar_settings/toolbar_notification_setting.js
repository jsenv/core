import { effect } from "@preact/signals"
import {
  notificationsEnabledSignal,
  notificationPermissionSignal,
  notificationAPIDetected,
  enableNotifications,
  disableNotifications,
  requestPermission,
} from "../../core/toolbar_notification.js"
import { enableVariant } from "../variant.js"

effect(() => {
  const notificationsEnabled = notificationsEnabledSignal.value
  const notificationPermission = notificationPermissionSignal.value
  if (!notificationAPIDetected) {
    applyNotificationNotAvailableEffects()
    return
  }
  if (notificationPermission === "default") {
    applyNotificationDefaultEffects()
    return
  }
  if (notificationPermission === "denied") {
    applyNotificationDeniedEffects()
    return
  }
  if (notificationPermission === "granted") {
    if (notificationsEnabled) {
      applyNotificationGrantedEffects()
      return
    }
    applyNotificationDisabledEffects()
    return
  }
})

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
const applyNotificationDisabledEffects = () => {}
const applyNotificationNOTGrantedEffects = () => {
  enableVariant(document.querySelector(".notification_text"), {
    notif_granted: "no",
  })
  notifCheckbox.disabled = true
  notifCheckbox.checked = false
  document.querySelector("a.request_notification_permission").onclick = () => {
    requestPermission()
  }
}
