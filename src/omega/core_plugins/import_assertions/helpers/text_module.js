export const convertTextToJavascriptModule = ({ content }) => {
  return {
    contentType: "text/javascript",
    content: `export default ${JSON.stringify(content)}`,
  }
}
