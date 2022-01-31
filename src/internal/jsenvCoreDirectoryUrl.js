export const jsenvCoreDirectoryUrl = new URL(
  // get ride of src/internal/jsenvCoreDirectoryUrl.js
  "../../",
  import.meta.url,
)

export const jsenvDistDirectoryUrl = new URL("./dist/", jsenvCoreDirectoryUrl)
