# [signal updates with different default values (enabled defaults to false)](../../route_url_sync.test.js#L817)

```js
try {
  const enabledSignal = stateSignal(false, {
    id: "enabled",
    type: "boolean",
  });

  const minuteSignal = stateSignal(30, {
    id: "minute",
    type: "number",
  });

  // Create route with multiple query parameters, enabled defaults to false
  const { SETTINGS_ROUTE } = setupRoutes({
    SETTINGS_ROUTE: `/settings?enabled=${enabledSignal}&minute=${minuteSignal}`,
  });

  // Start on the settings route with default values
  updateRoutes(`${baseUrl}/settings?enabled=false&minute=30`);

  const scenario1 = {
    description: "Initial state with default values (enabled=false, minute=30)",
    enabled_signal: enabledSignal.value,
    minute_signal: minuteSignal.value,
    route_matches: SETTINGS_ROUTE.matching,
    current_url: SETTINGS_ROUTE.url,
  };

  // Update enabled signal to true (non-default)
  enabledSignal.value = true;

  const scenario2 = {
    description: "After updating enabled signal to true (non-default)",
    enabled_signal: enabledSignal.value,
    minute_signal: minuteSignal.value,
    route_matches: SETTINGS_ROUTE.matching,
    current_url: SETTINGS_ROUTE.url,
  };

  // Update minute signal to non-default value
  minuteSignal.value = 45;

  const scenario3 = {
    description: "After updating minute signal to 45 (non-default)",
    enabled_signal: enabledSignal.value,
    minute_signal: minuteSignal.value,
    route_matches: SETTINGS_ROUTE.matching,
    current_url: SETTINGS_ROUTE.url,
  };

  // Reset enabled back to default (false)
  enabledSignal.value = false;

  const scenario4 = {
    description: "After resetting enabled to default (false)",
    enabled_signal: enabledSignal.value,
    minute_signal: minuteSignal.value,
    route_matches: SETTINGS_ROUTE.matching,
    current_url: SETTINGS_ROUTE.url,
  };

  return {
    scenario1_initial_defaults: scenario1,
    scenario2_enabled_true_non_default: scenario2,
    scenario3_minute_non_default: scenario3,
    scenario4_enabled_back_to_default: scenario4,

    // Track URL evolution with different defaults
    url_progression: [
      scenario1.current_url,
      scenario2.current_url,
      scenario3.current_url,
      scenario4.current_url,
    ],

    // Verify URL omits default values
    url_behavior_with_false_default: {
      initial_clean_url: scenario1.current_url === "http://127.0.0.1/settings",
      enabled_true_appears: scenario2.current_url.includes("enabled=true"),
      enabled_false_omitted: !scenario4.current_url.includes("enabled=false"),
      minute_default_omitted: !scenario1.current_url.includes("minute=30"),
      minute_non_default_appears: scenario3.current_url.includes("minute=45"),
    },

    // Test explanation
    explanation: {
      purpose: "Test URL behavior when signal defaults are different (enabled=false by default)",
      key_difference: "enabled=false is now the default, so it gets omitted from URLs",
      contrast: "enabled=true now appears in URL as non-default value",
      use_case: "Different default values affect URL cleanliness",
    },
  };
} finally {
  clearAllRoutes();
  globalSignalRegistry.clear();
}
```

```js
{
  "scenario1_initial_defaults": {
    "description": "Initial state with default values (enabled=false, minute=30)",
    "enabled_signal": false,
    "minute_signal": 30,
    "route_matches": true,
    "current_url": "http://127.0.0.1/settings"
  },
  "scenario2_enabled_true_non_default": {
    "description": "After updating enabled signal to true (non-default)",
    "enabled_signal": true,
    "minute_signal": 30,
    "route_matches": true,
    "current_url": "http://127.0.0.1/settings?enabled=true"
  },
  "scenario3_minute_non_default": {
    "description": "After updating minute signal to 45 (non-default)",
    "enabled_signal": true,
    "minute_signal": 45,
    "route_matches": true,
    "current_url": "http://127.0.0.1/settings?enabled=true&minute=45"
  },
  "scenario4_enabled_back_to_default": {
    "description": "After resetting enabled to default (false)",
    "enabled_signal": false,
    "minute_signal": 45,
    "route_matches": true,
    "current_url": "http://127.0.0.1/settings?minute=45"
  },
  "url_progression": [
    "http://127.0.0.1/settings",
    "http://127.0.0.1/settings?enabled=true",
    "http://127.0.0.1/settings?enabled=true&minute=45",
    "http://127.0.0.1/settings?minute=45"
  ],
  "url_behavior_with_false_default": {
    "initial_clean_url": false,
    "enabled_true_appears": true,
    "enabled_false_omitted": true,
    "minute_default_omitted": true,
    "minute_non_default_appears": true
  },
  "explanation": {
    "purpose": "Test URL behavior when signal defaults are different (enabled=false by default)",
    "key_difference": "enabled=false is now the default, so it gets omitted from URLs",
    "contrast": "enabled=true now appears in URL as non-default value",
    "use_case": "Different default values affect URL cleanliness"
  }
}
```

---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
