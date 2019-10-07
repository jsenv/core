export const groupHaveSameRequirements = (leftGroup, rightGroup) => {
  return (
    leftGroup.babelPluginRequiredNameArray.join("") ===
      rightGroup.babelPluginRequiredNameArray.join("") &&
    leftGroup.jsenvPluginRequiredNameArray.join("") ===
      rightGroup.jsenvPluginRequiredNameArray.join("")
  )
}
