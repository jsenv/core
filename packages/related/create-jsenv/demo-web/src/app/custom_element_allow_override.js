// https://github.com/lit/lit/issues/1844
// https://github.com/vegarringdal/custom-elements-hmr-polyfill/tree/master

/*
 * Custom element registry does not allow to redefine a given element:
 * ```
 * DOMException: Failed to execute 'define' on 'CustomElementRegistry':
 * the name "${name}" has already been used with this registry
 * ```
 * But during dev we want to be able to override the custom element
 * when hot reload happens.
 * To achieve this we override "define" method during dev
 */

if (import.meta.dev) {
  const registry = new Map();
  const define = customElements.define;
  customElements.define = (name, Constructor, options) => {
    const existing = registry.get(name);
    if (existing) {
      Object.getOwnPropertyDescriptor();
      Object.assign(existing, Object.getOwnPropertyDescriptors(Constructor));
      return;
    }
    registry.set(name, Constructor);
    define.call(customElements, name, Constructor, options);
  };
}
