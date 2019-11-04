export const bundleOptionsToRollupParseOptions = ({ entryPointMap, nativeModulePredicate }) => {
  return {
    input: entryPointMap,
    external: (id) => nativeModulePredicate(id),
  }
}
