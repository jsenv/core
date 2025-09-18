// Example ESLint configuration for using @jsenv/eslint-plugin

export default [
  {
    plugins: {
      "@jsenv": await import("@jsenv/eslint-plugin"),
    },
    rules: {
      "@jsenv/no-extra-params": "warn",
    },
  },
];

// Alternative: Use the recommended configuration
// export default [
//   {
//     ...await import("@jsenv/eslint-plugin").then(m => m.default.configs.recommended),
//   },
// ];
