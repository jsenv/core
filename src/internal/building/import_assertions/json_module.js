export const convertJsonTextToJavascriptModule = ({ code }) => {
  // here we could do the following
  // return export default jsonText
  // This would return valid js, that would be minified later
  // however we will prefer using JSON.parse because it's faster
  // for js engine to parse JSON than JS

  return {
    code: `export default JSON.parse(${JSON.stringify(code.trim())})`,
  }
}
