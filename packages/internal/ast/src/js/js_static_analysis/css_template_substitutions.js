// A "${}" inside a css template hides the whole css from the build: nothing can
// be parsed, so nothing can be checked, rewritten or stripped.
// It can be kept readable when the expression stands exactly where a css value
// stands: "var(--jsenv-css-substitution-0)" is a value the css parser accepts
// anywhere a value is expected, so the css around it stays css, and the
// expression takes the placeholder's place back once the css is transformed.
// Anywhere else — a selector, an at-rule prelude, a property name, inside a
// string or inside url() — nothing can stand for the expression, and the
// template is left alone.

const PLACEHOLDER = (index) => `var(--jsenv-css-substitution-${index})`;

/**
 * @param {Object} templateLiteralNode a TemplateLiteral acorn node
 * @param {string} js the source the node comes from
 * @returns {{ content: string, substitutions: Array<{placeholder: string, expression: string}> }|null}
 *          null when at least one expression is not in a css value position
 */
export const buildCssTemplateSubstitutions = (templateLiteralNode, js) => {
  const { quasis, expressions } = templateLiteralNode;
  const parts = [];
  for (const quasi of quasis) {
    const { cooked } = quasi.value;
    if (cooked === undefined) {
      // an escape sequence acorn could not cook: what the css is cannot be told
      return null;
    }
    parts.push(cooked);
  }
  const substitutions = [];
  let content = parts[0];
  const positions = [];
  for (let i = 0; i < expressions.length; i++) {
    const placeholder = PLACEHOLDER(i);
    positions.push(content.length);
    substitutions.push({
      placeholder,
      expression: js.slice(expressions[i].start, expressions[i].end),
    });
    content += placeholder + parts[i + 1];
  }
  for (const position of positions) {
    if (!isCssValuePosition(content, position)) {
      return null;
    }
  }
  return { content, substitutions };
};

// Reads the css from its start up to "position", keeping just enough state to
// tell what the placeholder sitting there would be part of.
const isCssValuePosition = (css, position) => {
  let braceDepth = 0;
  let stringQuote = null;
  let inComment = false;
  // the functions the position is nested in, innermost last ("" for a plain
  // parenthesis); only url() has to be told apart, its argument is not a value
  const functionStack = [];
  // what has been read since the last "{", "}" or ";": a declaration value
  // starts after a ":", and an at-rule prelude starts with "@"
  let statementStart = 0;
  let colonSeen = false;
  let i = 0;
  while (i < position) {
    const char = css[i];
    if (inComment) {
      if (char === "*" && css[i + 1] === "/") {
        inComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (stringQuote) {
      if (char === "\\") {
        i += 2;
        continue;
      }
      if (char === stringQuote) {
        stringQuote = null;
      }
      i++;
      continue;
    }
    if (char === "/" && css[i + 1] === "*") {
      inComment = true;
      i += 2;
      continue;
    }
    if (char === '"' || char === "'") {
      stringQuote = char;
      i++;
      continue;
    }
    if (char === "(") {
      functionStack.push(readFunctionNameBefore(css, i));
      i++;
      continue;
    }
    if (char === ")") {
      functionStack.pop();
      i++;
      continue;
    }
    if (char === "{") {
      braceDepth++;
      statementStart = i + 1;
      colonSeen = false;
      i++;
      continue;
    }
    if (char === "}") {
      braceDepth--;
      statementStart = i + 1;
      colonSeen = false;
      i++;
      continue;
    }
    if (char === ";") {
      statementStart = i + 1;
      colonSeen = false;
      i++;
      continue;
    }
    if (char === ":" && functionStack.length === 0) {
      colonSeen = true;
      i++;
      continue;
    }
    i++;
  }
  if (inComment || stringQuote) {
    return false;
  }
  if (braceDepth === 0) {
    // outside any rule: a selector, or an at-rule prelude
    return false;
  }
  if (!colonSeen) {
    // a property name, or a nested selector
    return false;
  }
  if (css.slice(statementStart, position).trimStart().startsWith("@")) {
    // an at-rule prelude nested in a rule, "@media (min-width: ...)"
    return false;
  }
  if (functionStack[functionStack.length - 1] === "url") {
    // url() takes an url, and an url built at runtime is not one the build
    // can follow to a file
    return false;
  }
  // A ":" also opens a pseudo class, so what looks like a value here can still
  // be the end of a nested selector; that is settled by what closes it.
  return closedByDeclarationEnd(css, position);
};

const readFunctionNameBefore = (css, parenthesisIndex) => {
  let start = parenthesisIndex;
  while (start > 0 && /[a-zA-Z0-9_-]/.test(css[start - 1])) {
    start--;
  }
  return css.slice(start, parenthesisIndex).toLowerCase();
};

// A declaration ends on ";" or "}"; reaching "{" first means what was read is
// a selector.
const closedByDeclarationEnd = (css, position) => {
  let stringQuote = null;
  let inComment = false;
  let i = position;
  while (i < css.length) {
    const char = css[i];
    if (inComment) {
      if (char === "*" && css[i + 1] === "/") {
        inComment = false;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (stringQuote) {
      if (char === "\\") {
        i += 2;
        continue;
      }
      if (char === stringQuote) {
        stringQuote = null;
      }
      i++;
      continue;
    }
    if (char === "/" && css[i + 1] === "*") {
      inComment = true;
      i += 2;
      continue;
    }
    if (char === '"' || char === "'") {
      stringQuote = char;
      i++;
      continue;
    }
    if (char === ";" || char === "}") {
      return true;
    }
    if (char === "{") {
      return false;
    }
    i++;
  }
  // the last declaration of the template may end without ";"
  return true;
};

/**
 * Puts the expressions back where their placeholder stands and renders the
 * template literal to write in place of the original one.
 * @returns {string|null} null when a placeholder did not survive the css
 *          transformation as it was written: what would be given back would
 *          not be what the source said
 */
export const renderCssTemplateLiteral = (content, substitutions) => {
  for (const { placeholder } of substitutions) {
    const index = content.indexOf(placeholder);
    if (index === -1) {
      return null;
    }
    if (content.indexOf(placeholder, index + placeholder.length) !== -1) {
      return null;
    }
  }
  let escaped = content
    .replace(/\\/g, "\\\\")
    .replace(/`/g, "\\`")
    .replace(/\$/g, "\\$");
  for (const { placeholder, expression } of substitutions) {
    escaped = escaped.replace(placeholder, () => `\${${expression}}`);
  }
  return `\`${escaped}\``;
};
