import {
  MAX_RULE,
  MIN_RULE,
  ONE_OF_RULE,
  STEP_RULE,
  TYPE_RULE,
} from "./rules.js";
import { CANNOT_AUTOFIX, TYPES } from "./types.js";

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
 * - `validSuggestion` {Object|null}: Auto-fix suggestion with `{value}` property
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
 * console.log(validity.validSuggestion); // { value: 1 }
 *
 * @example
 * // Type validation with auto-conversion
 * const [validity, applyOn] = createValidity({ type: 'number' });
 *
 * applyOn('123');
 * console.log(validity.valid); // false
 * console.log(validity.validSuggestion); // { value: 123 }
 *
 * @example
 * // Enumeration validation
 * const [validity, applyOn] = createValidity({
 *   oneOf: ['red', 'green', 'blue']
 * });
 *
 * applyOn('yellow');
 * console.log(validity.oneOf); // "must be one of: red, green, blue"
 * console.log(validity.validSuggestion); // { value: 'red' }
 *
 * @throws {Error} When ruleConfig contains invalid rule values:
 * - type must be a string
 * - min must be less than or equal to max
 * - step must be a positive number
 * - oneOf must be a non-empty array
 */
export const createValidity = (ruleConfig) => {
  const validity = {};

  const { representation, ...ruleConfigWithoutRepresentation } = ruleConfig;
  ruleConfig = ruleConfigWithoutRepresentation;

  // Resolve the serialize/deserialize pair for the chosen representation.
  // - deserialize: converts from the chosen representation to the canonical value before validation
  // - serialize: converts from the canonical value back to the chosen representation (e.g. for validSuggestion)
  let deserialize = null;
  let serialize = null;
  if (representation) {
    const theType = ruleConfig.type;
    const typeDef = theType ? TYPES[theType] : null;
    const repr = typeDef?.representations?.[representation];
    if (repr) {
      deserialize = repr.deserialize;
      serialize = repr.serialize;
    } else {
      console.warn(
        `[createValidity] Unknown representation "${representation}" for type "${theType}"`,
      );
    }
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
    validity.validSuggestion = null;
  }

  const applyOn = (value) => {
    // Deserialize from chosen representation to canonical before validating
    if (deserialize && value !== undefined) {
      const deserialized = deserialize(value);
      if (deserialized !== CANNOT_AUTOFIX) {
        value = deserialized;
      }
    }
    if (value === undefined) {
      validity.valid = true;
      validity.validSuggestion = null;
      return value;
    }
    let valid = true;
    let validSuggestion = null;

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
      if (validSuggestion) {
        // Don't try to create a new suggestion if we already have a valid one
        continue;
      }
      const autoFixResult = autoFix();
      if (autoFixResult === CANNOT_AUTOFIX) {
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
        if (nestedFix === CANNOT_AUTOFIX) {
          candidateIsValid = false;
          break;
        }
        valueCandidate = nestedFix;
      }
      if (!candidateIsValid) {
        continue;
      }
      if (candidateIsValid) {
        validSuggestion = {
          value: valueCandidate,
        };
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
        validSuggestion = {
          value: valueCandidate,
        };
      }
    }

    validity.valid = valid;
    // Serialize validSuggestion back to the chosen representation
    if (validSuggestion && serialize) {
      validSuggestion = { value: serialize(validSuggestion.value) };
    }
    validity.validSuggestion = validSuggestion;
    return value;
  };

  return [validity, applyOn];
};
