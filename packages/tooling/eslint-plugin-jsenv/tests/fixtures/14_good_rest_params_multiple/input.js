function process({ config, ...settings }, { data, ...meta }) {
  console.log(config, settings, data, meta);
}
process(
  { config: "dev", debug: true, cache: false },
  { data: [1, 2, 3], version: 1, timestamp: Date.now() },
);
