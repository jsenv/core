const { serveFile } = import.meta.require("@dmail/server")

export const servePuppeteerHtml = ({
  projectPathname,
  HTMLTemplateRelativePath,
  request: { ressource, headers },
}) => {
  if (ressource !== "/") return null
  return serveFile(`${projectPathname}${HTMLTemplateRelativePath}`, { headers })
}
