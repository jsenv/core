export const htmlAttributeSrcSet = {
  parse: (srcset) => {
    const srcCandidates = []
    srcset.split(",").forEach((set) => {
      const [specifier, descriptor] = set.trim().split(" ")
      srcCandidates.push({
        specifier,
        descriptor,
      })
    })
    return srcCandidates
  },
  stringify: (srcCandidates) => {
    const srcset = srcCandidates
      .map(({ specifier, descriptor }) => `${specifier} ${descriptor}`)
      .join(", ")
    return srcset
  },
}
