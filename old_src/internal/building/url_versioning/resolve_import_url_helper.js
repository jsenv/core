/* eslint-env browser */
window.__resolveImportUrl__ = (url, baseUrl) => {
  const importmapNode = document.querySelector('[type="importmap"]')

  if (importmapNode) {
    const importmap = JSON.parse(importmapNode.textContent)
    const specifier = importmap.imports[url] || url
    return new URL(specifier, baseUrl)
  }

  return new URL(url, baseUrl)
}
