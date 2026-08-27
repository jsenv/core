/**
 * Where navi meets @jsenv/validity.
 *
 * validity names a refusal with a key and its parameters rather than a
 * sentence, so that a field and a server can refuse in the same words in the
 * language of the person reading. navi is one of those two callers: it says the
 * sentence, in the browser, through `naviI18n`. The keys line up on purpose —
 * validity's `"single_space.start"` is navi's `"constraint.single_space.start"`
 * — so overriding a message is looking up one key, not going through a
 * translation table.
 *
 * The other direction is `constraintFromValidityRule`: a rule an app wrote for
 * its server, worn by a control as a constraint.
 */

import { naviI18n } from "@jsenv/navi/src/text/navi_i18n.js";

/**
 * Turns a @jsenv/validity rule into a constraint a control can wear, so an app
 * rule written once — in the package its server reads too — is checked on both
 * sides instead of being written twice.
 *
 * @param {object} rule
 *   `{ name, applyOn(ruleValue, value, ruleConfig) }`, the same object passed
 *   to `createValidity({ rules })`.
 * @param {object} [ruleConfig]
 *   What parameterizes the rule, under its own name — `{ maxWords: 40 }` for a
 *   rule named `maxWords`. Pass `formatMessage` here to say the refusal through
 *   the app's own i18n; without it the key is looked up in `naviI18n` under
 *   `constraint.<key>`, and a rule answering with a finished sentence is shown
 *   as-is.
 *
 * Call it once, at module level: a constraint rebuilt on every render is a new
 * object on every check.
 */
export const constraintFromValidityRule = (rule, ruleConfig = {}) => {
  const { formatMessage, ...ruleParams } = ruleConfig;
  return {
    name: rule.name,
    check: (field) => {
      const result = rule.applyOn(
        ruleParams[rule.name],
        field.uiState,
        ruleParams,
      );
      if (!result) {
        return null;
      }
      if (typeof result === "string") {
        return result;
      }
      if (formatMessage) {
        return formatMessage(result.key, result.params);
      }
      return naviI18nFromValidityMessage(result);
    },
  };
};

export const naviI18nFromValidityMessage = ({ key, params }) => {
  if (params && typeof params.max === "number") {
    // Lets a template pluralize on the bound it names: "[max] retour[s]".
    return naviI18n(`constraint.${key}`, {
      ...params,
      s: params.max > 1 ? "s" : "",
    });
  }
  return naviI18n(`constraint.${key}`, params);
};
