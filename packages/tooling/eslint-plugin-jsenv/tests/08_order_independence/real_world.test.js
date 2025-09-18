import { RuleTester } from "eslint";
import rule from "../../lib/rules/no-extra-params.js";

const ruleTester = new RuleTester({
  languageOptions: {
    ecmaVersion: 2020,
    sourceType: "module",
    parserOptions: {
      ecmaFeatures: {
        jsx: true,
      },
    },
  },
});

// Real-world scenario: React components defined after usage
const realWorldScenario = `
// App component using components before they're defined
function App() {
  return (
    <div>
      <Header title="My App" subtitle="Welcome" theme="dark" />
      <MainContent data="content" layout="grid" extra="unused" />
      <Footer year={2024} />
    </div>
  );
}

// Component definitions after usage
function Header({ title, subtitle, ...rest }) {
  return <Navigation {...rest} />;
}

function Navigation({ theme }) {
  return <nav className={theme}>{/* navigation */}</nav>;
}

function MainContent({ data, layout, ...rest }) {
  return processContent({ ...rest });
}

function processContent({ extra }) {
  // This actually uses 'extra', so it shouldn't be flagged
  return <div>{extra}</div>;
}

function Footer({ year }) {
  return <footer>&copy; {year}</footer>;
}
`;

console.log("Testing real-world React scenario with order independence...");

ruleTester.run("real-world order independence", rule, {
  valid: [
    {
      name: "Real-world React components with complex chaining",
      code: realWorldScenario,
    },
  ],
  invalid: [],
});

console.log("✅ Real-world scenario test passed!");
