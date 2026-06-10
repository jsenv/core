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

  const {
    representation,
    localStorageRepresentation: localStorageRepresentationOverride,
    urlRepresentation: urlRepresentationOverride,
    ...ruleConfigWithoutRepresentation
  } = ruleConfig;
  ruleConfig = ruleConfigWithoutRepresentation;

  const theType = ruleConfig.type;
  const typeDef = theType ? TYPES[theType] : null;

  // parse: when a representation option is passed, converts any input value to
  // canonical form before validation by trying all known representations.
  let parse = null;
  // representationFormat: format fn for the explicit representation option,
  // used to format validSuggestion back to the caller's expected format.
  let representationFormat = null;
  if (representation) {
    const repr = typeDef?.representations?.[representation];
    if (!repr) {
      throw new Error(
        `[createValidity] Unknown representation "${representation}" for type "${theType}"`,
      );
    }
    if (!repr.format) {
      throw new Error(
        `[createValidity] Representation "${representation}" for type "${theType}" has no format function`,
      );
    }
    representationFormat = repr.format;
    const allRepresentations = typeDef.representations
      ? Object.values(typeDef.representations)
      : [];
    parse = (value) => {
      // Try each representation's parse until one succeeds
      for (const r of allRepresentations) {
        if (!r.parse) {
          continue;
        }
        const result = r.parse(value);
        if (result !== CANNOT_CONVERT) {
          return result;
        }
      }
      return CANNOT_CONVERT;
    };
  }

  // Determine which named storage targets to track in validity.representations.
  // Each target: { reprName, formatFn } — used to populate { type, value } entries.
  // "url" and "localStorage" come from the type def (overridable via ruleConfig options).
  // An explicit "representation" option adds its own named entry.
  const storageTargets = []; // [{ key, reprName, formatFn }]
  const addStorageTarget = (key, reprName) => {
    if (!reprName) {
      return;
    }
    const repr = typeDef?.representations?.[reprName];
    if (!repr?.format) {
      return;
    }
    storageTargets.push({ key, reprName, formatFn: repr.format });
  };
  const effectiveLocalStorageRepr =
    localStorageRepresentationOverride ?? typeDef?.localStorageRepresentation;
  const effectiveUrlRepr =
    urlRepresentationOverride ?? typeDef?.urlRepresentation;
  addStorageTarget("localStorage", effectiveLocalStorageRepr);
  addStorageTarget("url", effectiveUrlRepr);
  if (representation) {
    // Only add if not already covered by the storage targets above
    const alreadyTracked = storageTargets.some(
      (t) => t.reprName === representation,
    );
    if (!alreadyTracked) {
      addStorageTarget(representation, representation);
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
    if (storageTargets.length > 0) {
      validity.representations = {};
      for (const { key, reprName } of storageTargets) {
        validity.representations[key] = { type: reprName, value: undefined };
      }
    }
  }

  const applyOn = (value) => {
    // Parse from chosen representation to canonical before validating
    if (parse && value !== undefined) {
      const parsed = parse(value);
      if (parsed !== CANNOT_CONVERT) {
        value = parsed;
      }
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
    // Format validSuggestion back to the explicit representation option
    if (validSuggestion && representationFormat) {
      validSuggestion = { value: representationFormat(validSuggestion.value) };
    }
    validity.validSuggestion = validSuggestion;
    // Update validity.representations for each storage target
    if (storageTargets.length > 0) {
      for (const { key, reprName, formatFn } of storageTargets) {
        validity.representations[key] = {
          type: reprName,
          value: valid ? formatFn(value) : undefined,
        };
      }
    }
    return value;
  };

  return [validity, applyOn];
};
