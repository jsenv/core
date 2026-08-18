/*
 * Packages that must be republished when one of their related packages is updated,
 * even if they don't depend on them in package.json
 */

export const packagesRelations = {
  "@jsenv/cli": [
    "jsenv-template-node-package",
    "jsenv-template-web",
    "jsenv-template-web-preact",
    "jsenv-template-web-react",
  ],
};
