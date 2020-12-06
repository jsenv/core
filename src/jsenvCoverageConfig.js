export const jsenvCoverageConfig = {
  "./index.js": true,
  "./main.js": true,
  "./src/**/*.js": true,
  "./**/*.test.*": false, // contains .test. -> nope
  "./**/test/": false, // inside a test folder -> nope,
}
