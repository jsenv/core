export const minifyJson = ({ jsonUrlInfo }) => {
  const { content } = jsonUrlInfo
  if (content.startsWith("{\n")) {
    const jsonWithoutWhitespaces = JSON.stringify(JSON.parse(content))
    return jsonWithoutWhitespaces
  }
  return null
}
