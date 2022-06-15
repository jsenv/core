export const urlTargetsSameFileSystemPath = (leftUrl, rightUrl) => {
  if (leftUrl.endsWith("/")) leftUrl = leftUrl.slice(0, -1)
  if (rightUrl.endsWith("/")) rightUrl = rightUrl.slice(0, -1)
  return leftUrl === rightUrl
}
