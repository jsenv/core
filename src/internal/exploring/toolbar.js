const toolbarElement = document.querySelector("#toolbar")

window.toolbar = {
  element: toolbarElement,
  show: showToolbar,
  hide: hideToolbar,
}

export const renderToolbar = (fileRelativeUrl) => {
  if (fileRelativeUrl) {
    document.querySelector("#button-state-indicator").onclick = () => toggleTooltip("serverState")
    document.querySelector("#button-execution-indicator").onclick = () =>
      toggleTooltip("fileExecution")
    document.querySelector("#button-close-toolbar").onclick = closeToolbar

    document.querySelector("#button-state-indicator").style.display = ""
    document.querySelector(".fileName").value = fileRelativeUrl

    var input = document.querySelector("input") // get the input element
    resizeInput(input) // immediately call the function
  } else {
    document.querySelector("#button-state-indicator").style.display = "none"
  }
}

export const applyStateIndicator = (state, { connect, abort, disconnect, reconnect }) => {
  const stateIndicator = document.getElementById("stateIndicatorCircle")
  const stateIndicatorRing = document.getElementById("stateIndicatorRing")
  const tooltiptext = document.querySelector(".tooltipTextServerState")
  const retryIcon = document.querySelector(".retryIcon")

  // remove all classes before applying the right ones
  stateIndicatorRing.classList.remove("loadingRing")
  stateIndicator.classList.remove("loadingCircle", "redCircle", "greenCircle")
  retryIcon.classList.remove("retryIconDisplayed")

  if (state === "off") {
    tooltiptext.innerHTML = `Livereloading disabled <a href="javascript:void(0);">connect</a>`
    tooltiptext.querySelector("a").onclick = connect
  } else if (state === "connecting") {
    stateIndicator.classList.add("loadingCircle")
    stateIndicatorRing.classList.add("loadingRing")
    tooltiptext.innerHTML = `Connecting to livereload event source... <a href="javascript:void(0);">cancel</a>`
    tooltiptext.querySelector("a").onclick = abort
  } else if (state === "connected") {
    stateIndicator.classList.add("greenCircle")
    tooltiptext.innerHTML = `Connected to livereload server <a href="javascript:void(0);">disconnect</a>`
    tooltiptext.querySelector("a").onclick = disconnect
  } else if (state === "disconnected") {
    stateIndicator.classList.add("redCircle")
    tooltiptext.innerHTML = `Disconnected from livereload server <a href="javascript:void(0);">reconnect</a>`
    tooltiptext.querySelector("a").onclick = reconnect
  }
}

export const applyFileExecutionIndicator = (state, duration) => {
  const checkIcon = document.getElementById("checkIconSvg")
  const crossIcon = document.getElementById("failIconSvg")
  const loader = document.getElementById("loaderSvg")
  const tooltiptext = document.querySelector(".tooltipTextFileExecution")

  // remove all classes before applying the right ones
  checkIcon.classList.remove("animateCheck")
  crossIcon.classList.remove("animateCross")
  loader.classList.remove("animateLoader")

  if (state === "loading") {
    loader.classList.add("animateLoader")
    tooltiptext.innerHTML = "Executing..."
  } else if (state === "success") {
    checkIcon.classList.add("animateCheck")
    tooltiptext.innerHTML = `Execution completed in ${duration}ms`
  } else if (state === "failure") {
    crossIcon.classList.add("animateCross")
    tooltiptext.innerHTML = `Execution failed in ${duration}ms`
  }
}

export const showToolbar = () => {
  document.documentElement.setAttribute("data-toolbar-visible", "")
}

export const hideToolbar = () => {
  document.documentElement.removeAttribute("data-toolbar-visible")
}

const resizeInput = (input) => {
  if (input.value.length > 40) {
    input.style.width = "40ch"
  } else {
    input.style.width = `${input.value.length}ch`
  }
}

const toggleTooltip = (name) => {
  document.querySelector(`.${name}`).classList.toggle("tooltipVisible")
}

const closeToolbar = () => {
  document.querySelector(".serverState").classList.remove("tooltipVisible")
  document.querySelector(".fileExecution").classList.remove("tooltipVisible")
  document.documentElement.removeAttribute("data-toolbar-visible")
}
