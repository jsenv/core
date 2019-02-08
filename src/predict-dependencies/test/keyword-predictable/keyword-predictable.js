// predictable
import("./top-level.js")

// not predictable (but it is, staticDependencyInDynamicImportIsPredictable is not very smart for now)
{
  import("./inside-block.js")
}

// not predictable (but it is, staticDependencyInDynamicImportIsPredictable is not very smart for now)
;(() => {
  import("./inside-iife.js")
})()

// not predictable
if (typeof window === "object") {
  import("./inside-if.js")
}

// not predictable
export const a = () => {
  import("./inside-function.js")
}
