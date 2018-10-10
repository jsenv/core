import { createFileStructure } from "@dmail/project-structure"

export const createPredicateFromStructure = ({ root }) => {
  return createFileStructure({
    root,
  }).then(({ getMetaForLocation }) => {
    const instrumentPredicate = (filenameRelative) => {
      return Boolean(getMetaForLocation(filenameRelative).cover)
    }

    const watchPredicate = (filenameRelative) => {
      return Boolean(getMetaForLocation(filenameRelative).watch)
    }

    return { instrumentPredicate, watchPredicate }
  })
}
