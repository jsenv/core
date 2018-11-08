const createChildError = (properties) => {
  const childError = new Error(properties.message)
  Object.assign(childError, properties)
  childError.name = "CHILD_ERROR"
  return childError
}

export const createCloseDuringExecutionError = (code) => {
  if (code === 12) {
    return createChildError({
      message: `child exited with 12: forked child wanted to use a non available port for debug`,
    })
  }
  return createChildError({ message: `child exited with ${code} during execution` })
}

export const createCrashAfterExecutedError = (code) => {
  return createChildError({ message: `child exited with ${code} after execution` })
}

export const createCrashAfterInterruptedError = (code) => {
  return createChildError({
    message: `child exited with ${code} after asking to interrupt`,
  })
}

export const createCrashAfterCancelError = (code) => {
  return createChildError({
    message: `child exited with code ${code}`,
  })
}
