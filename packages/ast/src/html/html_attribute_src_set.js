export const parseSrcset = (srcset) => {
  const srcCandidates = []
  srcset.split(",").forEach((set) => {
    const [specifier, descriptor] = set.trim().split(" ")
    srcCandidates.push({
      specifier,
      descriptor,
    })
  })
  return srcCandidates
}

export const stringifySrcSet = (srcCandidates) => {
  const srcset = srcCandidates
    .map(({ specifier, descriptor }) => `${specifier} ${descriptor}`)
    .join(", ")
  return srcset
}
