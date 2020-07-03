export const createHorizontalBreakpoint = (breakpointValue) => {
  return createBreakpoint(windowWidthMeasure, breakpointValue)
}

const createMeasure = ({ compute, register }) => {
  let currentValue = compute()

  const get = () => compute()

  const changed = createSignal()

  let unregister = () => {}
  if (register) {
    unregister = register(() => {
      const value = compute()
      if (value !== currentValue) {
        const previousValue = value
        currentValue = value
        changed.notify(value, previousValue)
      }
    })
  }

  return { get, changed, unregister }
}

const createSignal = () => {
  const callbackArray = []

  const listen = (callback) => {
    callbackArray.push(callback)
    return () => {
      const index = callbackArray.indexOf(callback)
      if (index > -1) {
        callbackArray.splice(index, 1)
      }
    }
  }

  const notify = (...args) => {
    callbackArray.slice().forEach((callback) => {
      callback(...args)
    })
  }

  return { listen, notify }
}

const windowWidthMeasure = createMeasure({
  name: "window-width",
  compute: () => window.innerWidth,
  register: (onchange) => {
    window.addEventListener("resize", onchange)
    window.addEventListener("orientationchange", onchange)
    return () => {
      window.removeEventListener("resize", onchange)
      window.removeEventListener("orientationchange", onchange)
    }
  },
})

const createBreakpoint = (measure, breakpointValue) => {
  const getBreakpointState = () => {
    const value = measure.get()

    if (value < breakpointValue) {
      return "below"
    }
    if (value > breakpointValue) {
      return "above"
    }
    return "equals"
  }

  let currentBreakpointState = getBreakpointState()

  const isAbove = () => {
    return measure.get() > breakpointValue
  }

  const isBelow = () => {
    return measure.get() < breakpointValue
  }

  const breakpointChanged = createSignal()

  measure.changed.listen(() => {
    const breakpointState = getBreakpointState()
    if (breakpointState !== currentBreakpointState) {
      const breakpointStatePrevious = currentBreakpointState
      currentBreakpointState = breakpointState
      breakpointChanged.notify(breakpointState, breakpointStatePrevious)
    }
  })

  return {
    isAbove,
    isBelow,
    changed: breakpointChanged,
  }
}

// const windowScrollTop = createMeasure({
//   name: "window-scroll-top",
//   compute: () => window.scrollTop,
//   register: (onchange) => {
//     window.addEventListener("scroll", onchange)
//     return () => {
//       window.removeEventListener("scroll", onchange)
//     }
//   },
// })
