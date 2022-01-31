export const jsenvCoreDirectoryUrl = String(
  new URL(
    // get ride of src/internal/jsenvCoreDirectoryUrl.js
    "../../",
    import.meta.url,
  ),
)

export const jsenvDistDirectoryUrl = String(
  new URL("./dist/", jsenvCoreDirectoryUrl),
)
