const meta = import.meta

const url = import.meta.url

const { url: urlDestructured } = import.meta

export { meta, url, urlDestructured }

export const typeOfImportMetaDev = typeof import.meta.dev

export const importMetaHot = import.meta.hot

import.meta.hot.accept(() => {})
