export const filenameRelativeToInstrumentedHref = ({
  compileInto,
  compileServerOrigin,
  compileId,
  filenameRelative,
}) =>
  `${getInstrumentedFolderHref({
    compileInto,
    compileServerOrigin,
    compileId,
  })}/${filenameRelative}`

const getInstrumentedFolderHref = ({ compileInto, compileServerOrigin, compileId }) =>
  `${compileServerOrigin}/${compileInto}/${compileId}-instrumented`
