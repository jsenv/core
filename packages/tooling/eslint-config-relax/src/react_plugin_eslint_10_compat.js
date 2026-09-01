/*
 * ESLint 10 removed the deprecated method form of a few rule context accessors
 * (getFilename, getCwd, getSourceCode, parserOptions); only the property form
 * survives. "eslint-plugin-react" still calls the method form in
 * lib/util/version.js and lib/rules/jsx-filename-extension.js, so every one of
 * its rules throws "context.getFilename is not a function" under ESLint 10.
 *
 * Upstream tracks this in https://github.com/jsx-eslint/eslint-plugin-react/issues/3977
 * (open since february 2026, no fix released). Until it lands, hand each rule a
 * context that answers both forms.
 *
 * Delete this file, and its use in eslint_config_relax.js, once
 * eslint-plugin-react ships an ESLint 10 compatible release.
 */

const eslint10Context = (context) =>
  new Proxy(context, {
    get: (target, property, receiver) => {
      if (property === "getFilename") {
        return () => target.filename;
      }
      if (property === "getPhysicalFilename") {
        return () => target.physicalFilename;
      }
      if (property === "getCwd") {
        return () => target.cwd;
      }
      if (property === "getSourceCode") {
        return () => target.sourceCode;
      }
      if (property === "parserOptions") {
        return target.languageOptions?.parserOptions || {};
      }
      return Reflect.get(target, property, receiver);
    },
  });

export const reactPluginEslint10Compat = (reactPlugin) => {
  return {
    ...reactPlugin,
    rules: Object.fromEntries(
      Object.entries(reactPlugin.rules).map(([name, rule]) => [
        name,
        {
          ...rule,
          create: (context) => rule.create(eslint10Context(context)),
        },
      ]),
    ),
  };
};
