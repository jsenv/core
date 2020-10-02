import { collectCssUrls } from "./collectCssUrls.js"
import { transformCssFiles } from "./transformCssFiles.js"

export const transformCss = async (css, cssFileUrl, projectDirectoryUrl) => {
  const cssDependencies = await collectCssUrls(css, cssFileUrl, projectDirectoryUrl)

  const {
    assetUrlMappings,
    assetSources,
    cssUrlMappings,
    cssContentMappings,
  } = await transformCssFiles(cssDependencies, projectDirectoryUrl)

  // assetUrlMappings + cssUrlMappings
  // seront nécéssaire a rollup pour
  // https://rollupjs.org/guide/en/#resolvefileurl
  // qu'on lui dise ah en fait ils sont la +
  // augmentChunkHash dans lequel on ajouteras le chemin vers ces fichiers
  // comme faisant partie du chunk si un fichier y fait référence

  // pour cssContentMappings c'est ce sur quoi on va faire
  // emitFile pour rollup en indiquand que ce sont des assets

  return { assetSources, assetUrlMappings, cssUrlMappings, cssContentMappings }
}
