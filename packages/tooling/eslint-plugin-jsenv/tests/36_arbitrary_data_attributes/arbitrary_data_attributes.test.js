import { noUnknownParamsRule } from "@jsenv/eslint-plugin";
import { RuleTester } from "eslint";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2022,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

/**
 * Reproduction of false positive:
 *
 * When a component uses a plain `props` parameter (no destructuring),
 * the rule should treat it as accepting all props and stop reporting errors
 * for any props passed to callers that ultimately spread into it.
 *
 * Here `Top` receives `props` and spreads into `Middle`.
 * `Middle` destructures `a` but passes `...rest` to `Inner`.
 * `Inner` uses plain `props` — accepts everything.
 *
 * The rule incorrectly flags `loading` and `data-custom` on `<Top>`
 * because it cannot trace that they survive through the rest chain into Inner(props).
 */
ruleTester.run(
  "no-unknown-params - plain props parameter should accept all",
  noUnknownParamsRule,
  {
    valid: [
      {
        name: "props passed to component with plain props param should not be flagged",
        options: [{ reportAllUnknownParams: true }],
        code: `
const Inner = (props) => {
  return <div {...props} />;
};

const Middle = ({ a, ...rest }) => {
  return <Inner {...rest} />;
};

const Top = (props) => {
  return <Middle {...props} />;
};

export const Usage = () => {
  return <Top a="x" loading={false} data-custom="value" />;
};
        `,
      },
    ],
    invalid: [],
  },
);
