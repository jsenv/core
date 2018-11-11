export const map = (generator, callback) => {
  return ({ next, ...rest }) => {
    return generator({
      next: (value) => {
        next(callback(value))
      },
      ...rest,
    })
  }
}
