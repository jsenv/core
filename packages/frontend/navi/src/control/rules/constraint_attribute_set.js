/**
 * The attributes constraints read, filled by each constraint module as it
 * evaluates. A constraint declares the attribute it wants (`"data-no-emoji"`)
 * and gets the prop for free: a control accepts the camelCase form
 * (`noEmoji`) and writes it on the control host under the attribute name — the
 * same conversion `element.dataset` does, so what a component is passed and
 * what ends up in the DOM read as one thing.
 */

export const CONSTRAINT_ATTRIBUTE_SET = new Set();

const dataAttributeCache = new Map();
// A constraint imported lazily registers its attribute after controls have
// already rendered, so an answer computed before it arrived must not survive it.
let attributeCountWhenCached = 0;
/**
 * The constraint attribute a prop stands for, `null` when it stands for none:
 * `"noEmoji"` → `"data-no-emoji"`.
 */
export const constraintAttributeFromProp = (key) => {
  if (attributeCountWhenCached !== CONSTRAINT_ATTRIBUTE_SET.size) {
    dataAttributeCache.clear();
    attributeCountWhenCached = CONSTRAINT_ATTRIBUTE_SET.size;
  }
  const fromCache = dataAttributeCache.get(key);
  if (fromCache !== undefined) {
    return fromCache;
  }
  let attribute = null;
  // An attribute is already written as one (`data-no-emoji`, `aria-label`) —
  // there is nothing to convert, and the literal lookup has already happened.
  if (!key.includes("-")) {
    const candidate = `data-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;
    if (CONSTRAINT_ATTRIBUTE_SET.has(candidate)) {
      attribute = candidate;
    }
  }
  dataAttributeCache.set(key, attribute);
  return attribute;
};

/**
 * Whether a constraint attribute is on. Present means on — `""` is how HTML
 * writes a bare attribute — and only the values that say "passed, and off"
 * turn it off.
 */
export const isConstraintAttributeOn = (value) =>
  value !== undefined && value !== null && value !== false;
