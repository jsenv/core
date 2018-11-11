export const filter = (generator, callback) => {
  return ({ next }) => {
    return generator({
      next: (value) => {
        if (callback(value)) {
          next(value)
        }
      },
    })
  }
}
