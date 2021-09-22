/* eslint-env browser */
window.__resolveImportUrl__ = (url, baseUrl) => {
  const importmapNode = document.querySelector('[type="importmap"]')

  if (importmapNode) {
    const importmap = JSON.parse(importmapNode.textContent)
    return new URL(importmap.imports[url], baseUrl)
  }

  return new URL(url, baseUrl)
}
