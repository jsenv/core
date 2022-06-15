export const getCommandArgument = (argv, name) => {
  let i = 0

  while (i < argv.length) {
    const arg = argv[i]

    if (arg === name) {
      return {
        name,
        index: i,
        value: "",
      }
    }

    if (arg.startsWith(`${name}=`)) {
      return {
        name,
        index: i,
        value: arg.slice(`${name}=`.length),
      }
    }

    i++
  }

  return null
}
