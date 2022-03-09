export const convertTextToJavascriptModule = ({ content }) => {
  return {
    contentType: "application/javascript",
    content: `export default ${JSON.stringify(content)}`,
  }
}
