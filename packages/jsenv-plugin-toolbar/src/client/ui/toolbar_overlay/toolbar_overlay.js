import { effect } from "@preact/signals"

import { openedSignal } from "../../core/toolbar_open_signals.js"
import { settingsOpenedSignal } from "../../core/settings_signals.js"
import { closeSettings } from "../../core/settings_actions.js"
import { closeAllTooltips } from "../../core/tooltip_actions.js"
import { serverTooltipOpenedSignal } from "../../core/server_signals.js"
import { executionTooltipOpenedSignal } from "../../core/execution_signals.js"
import { getToolbarIframe, setStyles } from "../util/dom.js"

export const renderToolbarOverlay = () => {
  const toolbarOverlay = document.querySelector("#toolbar_overlay")
  toolbarOverlay.onclick = () => {
    closeAllTooltips()
    closeSettings()
  }

  effect(() => {
    if (!window.parent) {
      // can happen while parent iframe reloads
      return
    }
    const opened = openedSignal.value
    const settingsOpened = settingsOpenedSignal.value
    const serverTooltipOpened = serverTooltipOpenedSignal.value
    const executionTooltipOpened = executionTooltipOpenedSignal.value
    if (!opened) {
      return
    }
    if (settingsOpened || serverTooltipOpened || executionTooltipOpened) {
      enableIframeOverflowOnParentWindow()
    } else {
      disableIframeOverflowOnParentWindow()
    }
  })
}

const enableIframeOverflowOnParentWindow = () => {
  const iframe = getToolbarIframe()

  const transitionDuration = iframe.style.transitionDuration
  setStyles(iframe, {
    "height": "100%",
    // we don't want to animate height transition
    // but if it was enabled, we'll restore it afterwards
    "transition-duration": "0ms",
  })
  if (transitionDuration) {
    setTimeout(() => {
      setStyles(iframe, { "transition-duration": transitionDuration })
    })
  }
}

const disableIframeOverflowOnParentWindow = () => {
  const iframe = getToolbarIframe()
  const transitionDuration = iframe.style.transitionDuration
  setStyles(iframe, {
    "height": "40px",
    // we don't want to animate height transition
    // but if it was enabled, we'll restore it afterwards
    "transition-duration": "0ms",
  })
  if (transitionDuration) {
    setTimeout(() => {
      setStyles(iframe, { "transition-duration": transitionDuration })
    })
  }
}
