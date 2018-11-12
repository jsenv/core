import { subscribe } from "./subscribe.js"

export const nextRace = (generatorMap, nextMap = {}) => {
  const observeMap = {}
  const names = Object.keys(generatorMap)

  let called = false
  const visit = (name) => {
    const generator = generatorMap[name]
    const subscription = subscribe(generator, {
      next: (value) => {
        called = true
        names.forEach((value) => {
          if (value !== name) {
            observeMap[value].unsubscribe()
          }
        })
        return name in nextMap ? nextMap[name](value) : undefined
      },
    })
    observeMap[name] = subscription
  }

  let i = 0
  while (i < names.length) {
    const name = names[i]
    i++
    visit(name)
    if (called) break
  }
}
