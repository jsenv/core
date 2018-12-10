export const createRestartController = () => {
  const signal = {
    onrestart: () => {},
  }

  const restart = (reason) => {
    signal.onrestart(reason)
  }

  return { signal, restart }
}

export const createRestartSignal = () => {
  return {
    onrestart: () => {},
  }
}
