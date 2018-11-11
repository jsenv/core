export const map = (generator, callback) => {
  return ({ next }) => {
    return generator({
      next: (value) => {
        next(callback(value))
      },
    })
  }
}
