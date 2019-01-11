import { eventRace } from "../eventHelper.js"
import { registerUngaranteedProcessBeforeExitCallback } from "./registerUngaranteedProcessBeforeExitCallback.js"

// when any of SIGUP, SIGINT, SIGTERM, beforeExit, exit is emitted
// call a given function allowed to return a promise in case the teardown is async
// it's very usefull to ensure a given server is closed when process exits
export const registerUngaranteedProcessTeardown = (callback) => {
  return eventRace({
    beforeExit: {
      register: registerUngaranteedProcessBeforeExitCallback,
      callback: () => callback("beforeExit"),
    },
    hangupOrDeath: {
      register: registerUngaranteedProcessHangupOrDeathCallback,
      callback: () => callback("hangupOrDeath"),
    },
    death: {
      register: registerUngaranteedProcessDeathCallback,
      callback: () => callback("death"),
    },
    exit: {
      register: registerUnguaranteedProcessExitCallback,
      callback: () => callback("exit"),
    },
  })
}

const registerUngaranteedProcessHangupOrDeathCallback = (callback) => {
  const triggerHangUpOrDeath = () => callback()
  // SIGHUP http://man7.org/linux/man-pages/man7/signal.7.html
  process.once("SIGUP", triggerHangUpOrDeath)
  return () => {
    process.removeListener("SIGUP", triggerHangUpOrDeath)
  }
}

const registerUngaranteedProcessDeathCallback = (callback) => {
  const triggerDeath = () => callback()
  // SIGTERM http://man7.org/linux/man-pages/man7/signal.7.html
  process.once("SIGTERM", triggerDeath)
  return () => {
    process.removeListener("SIGTERM", triggerDeath)
  }
}

const registerUnguaranteedProcessExitCallback = (callback) => {
  const triggerExit = () => callback()
  process.on("exit", triggerExit)
  return () => {
    process.removeListener("exit", triggerExit)
  }
}
