export const ExecOptions = {
  fromExecArgv: (execArgv) => {
    const execOptions = {}
    let i = 0
    while (i < execArgv.length) {
      const execArg = execArgv[i]
      const option = execOptionFromExecArg(execArg)
      execOptions[option.name] = option.value
      i++
    }
    return execOptions
  },
  toExecArgv: (execOptions) => {
    const execArgv = []
    Object.keys(execOptions).forEach((optionName) => {
      const optionValue = execOptions[optionName]
      if (optionValue === "unset") {
        return
      }
      if (optionValue === "") {
        execArgv.push(optionName)
        return
      }
      execArgv.push(`${optionName}=${optionValue}`)
    })
    return execArgv
  },
}

const execOptionFromExecArg = (execArg) => {
  const equalCharIndex = execArg.indexOf("=")
  if (equalCharIndex === -1) {
    return {
      name: execArg,
      value: "",
    }
  }
  const name = execArg.slice(0, equalCharIndex)
  const value = execArg.slice(equalCharIndex + 1)
  return {
    name,
    value,
  }
}
