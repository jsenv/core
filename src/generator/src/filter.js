export const filter = (generator, callback) => {
  return ({ next, ...rest }) => {
    return generator({
      next: (value) => {
        if (callback(value)) {
          next(value)
        }
      },
      ...rest,
    })
  }
}
