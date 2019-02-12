export const filenameRelativeToCompiledHref = ({
  compileInto,
  compileServerOrigin,
  compileId,
  filenameRelative,
}) =>
  `${getCompiledFolderHref({ compileInto, compileServerOrigin, compileId })}/${filenameRelative}`

const getCompiledFolderHref = ({ compileInto, compileId, compileServerOrigin }) =>
  `${compileServerOrigin}/${compileInto}/${compileId}`
