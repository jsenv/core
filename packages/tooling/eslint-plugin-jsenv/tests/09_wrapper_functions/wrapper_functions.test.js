import { RuleTester } from "eslint";
import rule from "../../lib/rules/no-unknown-params.js";

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

ruleTester.run("no-unknown-params - wrapper functions", rule, {
  valid: [
    {
      name: "forwardRef wrapper with valid props",
      code: `function MyComponent({ title, description }) {
  return (
    <div>
      {title}: {description}
    </div>
  );
}

const WrappedComponent = forwardRef(MyComponent);

export const App = () => <WrappedComponent title="Hello" description="World" />;`,
    },
    {
      name: "memo wrapper with valid props",
      code: `function MyComponent({ name, age }) {
  return (
    <div>
      {name} is {age} years old
    </div>
  );
}

const MemoizedComponent = memo(MyComponent);

export const App = () => <MemoizedComponent name="John" age={25} />;`,
    },
    {
      name: "React.forwardRef and React.memo with valid props",
      code: `function BaseComponent({ title, subtitle }) {
  return (
    <h1>
      {title} - {subtitle}
    </h1>
  );
}

const ReactForwardRefComponent = React.forwardRef(BaseComponent);
const ReactMemoComponent = React.memo(BaseComponent);

export const App = () => (
  <>
    <ReactForwardRefComponent title="Hello" subtitle="World" />
    <ReactMemoComponent title="React" subtitle="Memo" />
  </>
);`,
    },
    {
      name: "Function.bind wrapper with valid props",
      code: `function myFunction({ name, age }) {
  console.log(\`\${name} is \${age} years old\`);
}

const boundFunction = myFunction.bind(null);

boundFunction({ name: "Alice", age: 30 });`,
    },
  ],
  invalid: [
    {
      name: "forwardRef wrapper with extra prop",
      code: `function MyComponent({ title }) {
  return <div>{title}</div>;
}

const WrappedComponent = forwardRef(MyComponent);

export const App = () => <WrappedComponent title="Hello" extra="unused" />;`,
      output: `function MyComponent({ title }) {
  return <div>{title}</div>;
}

const WrappedComponent = forwardRef(MyComponent);

export const App = () => <WrappedComponent title="Hello"  />;`,
      errors: [
        {
          messageId: "notFoundParam",
          data: { param: "extra", func: "WrappedComponent" },
        },
      ],
    },
    {
      name: "memo wrapper with extra prop",
      code: `function MyComponent({ name }) {
  return <div>Hello {name}</div>;
}

const MemoizedComponent = memo(MyComponent);

export const App = () => <MemoizedComponent name="John" unused="extra" />;`,
      output: `function MyComponent({ name }) {
  return <div>Hello {name}</div>;
}

const MemoizedComponent = memo(MyComponent);

export const App = () => <MemoizedComponent name="John"  />;`,
      errors: [
        {
          messageId: "notFoundParam",
          data: { param: "unused", func: "MemoizedComponent" },
        },
      ],
    },
    {
      name: "React wrappers with extra props",
      code: `function BaseComponent({ title }) {
  return <h1>{title}</h1>;
}

const ReactForwardRefComponent = React.forwardRef(BaseComponent);
const ReactMemoComponent = React.memo(BaseComponent);

export const App = () => (
  <>
    <ReactForwardRefComponent title="Hello" extra1="unused" />
    <ReactMemoComponent title="React" extra2="unused" />
  </>
);`,
      output: `function BaseComponent({ title }) {
  return <h1>{title}</h1>;
}

const ReactForwardRefComponent = React.forwardRef(BaseComponent);
const ReactMemoComponent = React.memo(BaseComponent);

export const App = () => (
  <>
    <ReactForwardRefComponent title="Hello"  />
    <ReactMemoComponent title="React"  />
  </>
);`,
      errors: [
        {
          messageId: "notFoundParam",
          data: { param: "extra1", func: "ReactForwardRefComponent" },
        },
        {
          messageId: "notFoundParam",
          data: { param: "extra2", func: "ReactMemoComponent" },
        },
      ],
    },
    {
      name: "Function.bind wrapper with extra prop",
      code: `function myFunction({ name }) {
  console.log(\`Hello \${name}\`);
}

const boundFunction = myFunction.bind(null);

boundFunction({ name: "Alice", extra: "unused" });`,
      output: `function myFunction({ name }) {
  console.log(\`Hello \${name}\`);
}

const boundFunction = myFunction.bind(null);

boundFunction({ name: "Alice" });`,
      errors: [
        {
          messageId: "notFoundParam",
          data: { param: "extra", func: "boundFunction" },
        },
      ],
    },
  ],
});

console.log("✅ Wrapper functions tests passed!");
