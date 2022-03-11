window.__asVersionedSpecifier__ = (specifier) => {
  const importmapNode = document.querySelector('[type="importmap"]')
  if (importmapNode) {
    const importmap = JSON.parse(importmapNode.textContent)
    return importmap.imports[specifier] || specifier
  }
  return specifier
}
