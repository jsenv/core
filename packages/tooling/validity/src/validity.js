import {
  MAX_RULE,
  MIN_RULE,
  ONE_OF_RULE,
  STEP_RULE,
  TYPE_RULE,
} from "./rules.js";
import { CANNOT_CONVERT, TYPES } from "./types.js";

/**
 * Creates a validation system with configurable rules for data validation and auto-fixing.
 *
 * @param {Object} ruleConfig - Configuration object defining validation rules
 * @param {string} [ruleConfig.type] - Expected data type ('number', 'string', 'boolean', 'percentage', 'object')
 * @param {number} [ruleConfig.min] - Minimum value (for numbers)
 * @param {number} [ruleConfig.max] - Maximum value (for numbers)
 * @param {number} [ruleConfig.step] - Step increment for numbers (e.g., 0.1 for one decimal place, 1 for integers)
 * @param {Array} [ruleConfig.oneOf] - Array of allowed values (enumeration validation)
 *
 * @returns {[Object, Function]} Tuple containing:
 *   - validity: Reactive validity object with current validation state
 *   - applyOn: Function to validate values and update validity state
 *
 * @description
 * The returned validity object contains:
 * - `valid` {boolean}: Overall validation status
 * - `representations.valid` {Object|null}: Valid canonical value `{type, value}`, or null if no fix is possible
 * - `type` {string|undefined}: Type validation error message or undefined if valid
 * - `min` {string|undefined}: Minimum validation error message or undefined if valid
 * - `max` {string|undefined}: Maximum validation error message or undefined if valid
 * - `step` {string|undefined}: Step validation error message or undefined if valid
 * - `oneOf` {string|undefined}: Enumeration validation error message or undefined if valid
 *
 * The returned applyOn function:
 * - Takes a value to validate
 * - Updates the validity object with current validation state
 * - Provides auto-fix suggestions when possible
 * - Returns the original input value
 *
 * @example
 * // Number validation with range and step constraints
 * const [validity, applyOn] = createValidity({
 *   type: 'number',
 *   min: 0,
 *   max: 100,
 *   step: 0.5
 * });
 *
 * applyOn(1.23); // Invalid step
 * console.log(validity.valid); // false
 * console.log(validity.step); // "must be a multiple of 0.5"
 * console.log(validity.representations.valid); // { type: 'number', value: 1 }
 *
 * @example
 * // Type validation with auto-conversion
 * const [validity, applyOn] = createValidity({ type: 'number' });
 *
 * applyOn('123');
 * console.log(validity.valid); // false
 * console.log(validity.representations.valid); // { type: 'number', value: 123 }
 *
 * @example
 * // Enumeration validation
 * const [validity, applyOn] = createValidity({
 *   oneOf: ['red', 'green', 'blue']
 * });
 *
 * applyOn('yellow');
 * console.log(validity.oneOf); // "must be one of: red, green, blue"
 * console.log(validity.representations.valid); // { type: undefined, value: 'red' }
 *
 * @throws {Error} When ruleConfig contains invalid rule values:
 * - type must be a string
 * - min must be less than or equal to max
 * - step must be a positive number
 * - oneOf must be a non-empty array
 */
export const createValidity = (ruleConfig) => {
  const validity = {};
  const {
    localStorageRepresentation: localStorageRepresentationOverride,
    urlRepresentation: urlRepresentationOverride,
    customRepresentation,
    typeCoercion = true,
    autoFix: autoFixOption = false,
    ...ruleConfigWithoutRepresentation
  } = ruleConfig;
  ruleConfig = ruleConfigWithoutRepresentation;
  const theType = ruleConfig.type;
  const typeDef = theType ? TYPES[theType] : null;

  if (customRepresentation) {
    if (!typeDef?.representations?.[customRepresentation]) {
      throw new Error(
        `[createValidity] Unknown representation "${customRepresentation}" for type "${theType}"`,
      );
    }
  }

  // Determine which named storage targets to track in validity.representations.
  // Each target: { reprName, formatFn } — used to populate { type, value } entries.
  // "url" and "localStorage" come from the type def (overridable via ruleConfig options).
  // An explicit "representation" option adds its own named entry.
  const storageTargets = new Map(); // key → { type, formatFn }
  const addStorageTarget = (key, type) => {
    if (!type) {
      return;
    }
    const repr = typeDef?.representations?.[type];
    if (!repr?.format) {
      return;
    }
    storageTargets.set(key, { type, format: repr.format });
  };
  const effectiveLocalStorageRepr =
    localStorageRepresentationOverride ?? typeDef?.localStorageRepresentation;
  const effectiveUrlRepr =
    urlRepresentationOverride ?? typeDef?.urlRepresentation;
  addStorageTarget("localStorage", effectiveLocalStorageRepr);
  addStorageTarget("url", effectiveUrlRepr);
  if (customRepresentation) {
    addStorageTarget("custom", customRepresentation);
  }

  const ruleSet = new Set();
  let effectiveRuleConfig = {};
  setup: {
    const theType = ruleConfig.type;
    if (theType) {
      const typeDef = TYPES[theType];
      if (typeDef?.props) {
        for (const [propName, propDef] of Object.entries(typeDef.props)) {
          if (
            propDef.default !== undefined &&
            ruleConfig[propName] === undefined
          ) {
            effectiveRuleConfig[propName] = propDef.default;
          }
        }
      }
    }
    Object.assign(effectiveRuleConfig, ruleConfig);
    if (theType) {
      const typeDef = TYPES[theType];
      if (typeDef?.props) {
        for (const [propName, propDef] of Object.entries(typeDef.props)) {
          if (propDef.resolver && effectiveRuleConfig[propName] !== undefined) {
            effectiveRuleConfig[propName] = propDef.resolver(
              effectiveRuleConfig[propName],
            );
          }
        }
      }
    }
    const { type, min, max, step, oneOf, ...unknown } = effectiveRuleConfig;
    if (Object.keys(unknown).length > 0) {
      console.warn(
        "[createValidity] Unknown ruleConfig properties:",
        Object.keys(unknown),
      );
    }
    if (type !== undefined) {
      validity.type = undefined;
      if (typeof type !== "string") {
        throw new Error(`[createValidity] type must be a string`);
      }
      ruleSet.add({
        key: "type",
        rule: TYPE_RULE,
        ruleValue: type,
      });
    }
    if (min !== undefined) {
      validity.min = undefined;
      if (max !== undefined && min > max) {
        throw new Error(
          `[createValidity] min (${min}) is greater than max (${max})`,
        );
      }
      ruleSet.add({
        key: "min",
        rule: MIN_RULE,
        ruleValue: min,
      });
    }
    if (max !== undefined) {
      validity.max = undefined;
      if (min !== undefined && max < min) {
        throw new Error(
          `[createValidity] max (${max}) is less than min (${min})`,
        );
      }
      ruleSet.add({
        key: "max",
        rule: MAX_RULE,
        ruleValue: max,
      });
    }
    if (step !== undefined) {
      validity.step = undefined;
      if (typeof step !== "number" || step <= 0) {
        throw new Error(`[createValidity] step must be a positive number`);
      }
      ruleSet.add({
        key: "step",
        rule: STEP_RULE,
        ruleValue: step,
      });
    }
    if (oneOf !== undefined) {
      validity.oneOf = undefined;
      if (!Array.isArray(oneOf) || oneOf.length === 0) {
        throw new Error(`[createValidity] oneOf must be a non-empty array`);
      }
      ruleSet.add({
        key: "oneOf",
        rule: ONE_OF_RULE,
        ruleValue: oneOf,
      });
    }
    validity.valid = true;
    validity.value = undefined;
    validity.representations = { valid: null };
    for (const [key, { type }] of storageTargets) {
      validity.representations[key] = {
        type,
        value: undefined,
      };
    }
  }

  const applyOn = (value) => {
    // Type coercion: silently convert value to canonical form before validation.
    // Disabled when strict: true.
    if (typeCoercion && typeDef?.representations && value !== undefined) {
      for (const repr of Object.values(typeDef.representations)) {
        if (!repr.parse) {
          continue;
        }
        const parsed = repr.parse(value);
        if (parsed !== CANNOT_CONVERT) {
          value = parsed;
          break;
        }
      }
    }
    let valid = true;
    let validCanonicalValue;

    for (const { key, rule, ruleValue } of ruleSet) {
      const result = rule.applyOn(ruleValue, value, effectiveRuleConfig);
      if (!result) {
        // valid
        validity[key] = undefined;
        continue;
      }
      const { message, autoFix } = result;
      valid = false;
      validity[key] = message;
      if (!autoFix) {
        continue;
      }
      if (validCanonicalValue !== undefined) {
        // Don't try to create a new suggestion if we already have a valid one
        continue;
      }
      const autoFixResult = autoFix();
      if (autoFixResult === CANNOT_CONVERT) {
        // invalid and cannot autofix
        continue;
      }
      // Test the suggestion against all rules and apply one more auto-fix if needed
      let valueCandidate = autoFixResult;
      let candidateIsValid = true;
      for (const { rule, ruleValue } of ruleSet) {
        const result = rule.applyOn(
          ruleValue,
          valueCandidate,
          effectiveRuleConfig,
        );
        if (!result) {
          // This rule passes, keep trying all rules
          continue;
        }
        // This rule fails - try to auto-fix it too (chain auto-fixes)
        // we consider autofix is respecting previous autofixes
        if (!result.autoFix) {
          candidateIsValid = false;
          break;
        }
        const nestedFix = result.autoFix();
        if (nestedFix === CANNOT_CONVERT) {
          candidateIsValid = false;
          break;
        }
        valueCandidate = nestedFix;
      }
      if (!candidateIsValid) {
        continue;
      }
      // Test the final suggestion against all rules
      // (in case nested autofix is actually incompatible with all rules)
      let suggestionIsValid = true;
      for (const { rule, ruleValue } of ruleSet) {
        const result = rule.applyOn(
          ruleValue,
          valueCandidate,
          effectiveRuleConfig,
        );
        if (result) {
          suggestionIsValid = false;
          break;
        }
      }
      if (suggestionIsValid) {
        validCanonicalValue = valueCandidate;
      }
    }

    validity.valid = valid;
    // If autoFix is enabled and a suggestion exists, apply it silently
    if (autoFixOption && !valid && validCanonicalValue !== undefined) {
      value = validCanonicalValue;
      valid = true;
      validCanonicalValue = undefined;
      for (const { key } of ruleSet) {
        validity[key] = undefined;
      }
      validity.valid = true;
    }
    validity.value = value;
    validity.representations.valid =
      validCanonicalValue === undefined
        ? null
        : { type: theType, value: validCanonicalValue };
    for (const [key, { type, format }] of storageTargets) {
      if (key === "custom") {
        // custom always shows the coerced (and possibly autoFixed) input value
        validity.representations[key] = {
          type,
          value: value !== undefined ? format(value) : undefined,
        };
      } else {
        // localStorage/url only written when value is valid
        validity.representations[key] = {
          type,
          value: valid && value !== undefined ? format(value) : undefined,
        };
      }
    }
    return value;
  };

  return [validity, applyOn];
};
