# 4.0.0

- launching chromium must be done before requesting a lighthouse report
  - add runLighthouseOnPlaywrightPage
    - future versions might export helpers for puppeteer and chrome-laucher
  - remove dependency to chrome-laucher
  - allow dev to control and see how the browser is started (screen dimensions, touch events, ...)
- reportLighthouseImpact -> reportLighthouseImpactInGithubPullRequest
- generateLighthouseReport -> runLighthouseOnPlaywrightPage

# 3.1.0

- Add mobile = false param
- Add lighthouseSettings = {} param

# 3.0.0

- Rename lighthouseReportPath into lighthouseReportUrl
- Rename jsonFileRelativeUrl into jsonFileUrl
- Rename htmlFileRelativeUrl into htmlFileUrl
