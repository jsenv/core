function mixed({ config, ...settings }, { data, meta }) {
  console.log(config, settings, data, meta);
}
mixed(
  { config: "dev", debug: true, cache: false },
  { data: [1, 2, 3], extra: "should error" },
);
