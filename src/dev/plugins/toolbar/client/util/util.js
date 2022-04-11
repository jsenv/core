export const createPromiseAndHooks = () => {
  let resolve
  let reject
  const promise = new Promise((res, rej) => {
    resolve = res
    reject = rej
  })
  promise.resolve = resolve
  promise.reject = reject
  return promise
}

export const moveElement = (element, from, to) => {
  to.appendChild(element)
}

export const replaceElement = (elementToReplace, otherElement) => {
  elementToReplace.parentNode.replaceChild(otherElement, elementToReplace)
}
