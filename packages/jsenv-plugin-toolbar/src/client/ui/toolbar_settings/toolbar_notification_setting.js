import { effect } from "@preact/signals"

import {
  notificationsEnabledSignal,
  notificationPermissionSignal,
} from "../../core/notification_signals.js"
import { notificationAPIDetected } from "../../core/notification_context.js"
import {
  enableNotifications,
  disableNotifications,
  requestPermission,
} from "../../core/notification_actions.js"
import { enableVariant } from "../variant.js"

const notifCheckbox = document.querySelector("#toggle_notifs")

export const renderToolbarNotificationSetting = () => {
  effect(() => {
    const notificationsEnabled = notificationsEnabledSignal.value
    notifCheckbox.checked = notificationsEnabled
  })

  effect(() => {
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
      applyNotificationGrantedEffects()
      return
    }
  })
}

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
    requestPermission()
  }
}
