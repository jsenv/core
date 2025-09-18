function process({ config }, { data, meta }) {
  console.log(config, data, meta);
}
process(
  { config: "dev", extra: true },
  { data: [1, 2, 3], meta: { version: 1 }, unused: "test" },
);
