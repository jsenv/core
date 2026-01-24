# [signal updates should trigger URL changes with multiple query parameters](../../route_url_sync.test.js#L706)

```js
try {
  const enabledSignal = stateSignal(true, {
    id: "enabled",
    type: "boolean",
  });

  const minuteSignal = stateSignal(30, {
    id: "minute",
    type: "number",
  });

  // Create route with multiple query parameters
  const { SETTINGS_ROUTE } = setupRoutes({
    SETTINGS_ROUTE: `/settings?enabled=${enabledSignal}&minute=${minuteSignal}`,
  });

  // Start on the settings route with initial values
  updateRoutes(`${baseUrl}/settings?enabled=true&minute=30`);

  const scenario1 = {
    description: "Initial state with both parameters",
    enabled_signal: enabledSignal.value,
    minute_signal: minuteSignal.value,
    route_matches: SETTINGS_ROUTE.matching,
    current_url: SETTINGS_ROUTE.url,
  };

  // Update only the enabled signal
  enabledSignal.value = false;

  const scenario2 = {
    description: "After updating enabled signal to false",
    enabled_signal: enabledSignal.value,
    minute_signal: minuteSignal.value,
    route_matches: SETTINGS_ROUTE.matching,
    current_url: SETTINGS_ROUTE.url,
  };

  // Update only the minute signal
  minuteSignal.value = 45;

  const scenario3 = {
    description: "After updating minute signal to 45",
    enabled_signal: enabledSignal.value,
    minute_signal: minuteSignal.value,
    route_matches: SETTINGS_ROUTE.matching,
    current_url: SETTINGS_ROUTE.url,
  };

  // Update both signals at once
  enabledSignal.value = true;
  minuteSignal.value = 60;

  const scenario4 = {
    description: "After updating both signals together",
    enabled_signal: enabledSignal.value,
    minute_signal: minuteSignal.value,
    route_matches: SETTINGS_ROUTE.matching,
    current_url: SETTINGS_ROUTE.url,
  };

  return {
    scenario1_initial_state: scenario1,
    scenario2_enabled_changed: scenario2,
    scenario3_minute_changed: scenario3,
    scenario4_both_changed: scenario4,

    // Track URL evolution
    url_progression: [
      scenario1.current_url,
      scenario2.current_url,
      scenario3.current_url,
      scenario4.current_url,
    ],

    // Verify signal→URL synchronization
    signals_reflect_in_urls: {
      initial_url_contains_enabled_true:
        scenario1.current_url.includes("enabled=true"),
      initial_url_contains_minute_30:
        scenario1.current_url.includes("minute=30"),

      after_enabled_false: scenario2.current_url.includes("enabled=false"),
      enabled_change_preserves_minute:
        scenario2.current_url.includes("minute=30"),

      after_minute_45: scenario3.current_url.includes("minute=45"),
      minute_change_preserves_enabled:
        scenario3.current_url.includes("enabled=false"),

      final_enabled_true: scenario4.current_url.includes("enabled=true"),
      final_minute_60: scenario4.current_url.includes("minute=60"),
    },

    // Test explanation
    explanation: {
      purpose:
        "Test bidirectional sync: Signal→URL direction with multiple parameters",
      behavior:
        "Each signal update should rebuild URL with new values while preserving others",
      use_case:
        "Settings page where user changes multiple preferences independently",
    },
  };
} finally {
  clearAllRoutes();
  globalSignalRegistry.clear();
}
```

```js
{
  "scenario1_initial_state": {
    "description": "Initial state with both parameters",
    "enabled_signal": true,
    "minute_signal": 30,
    "route_matches": true,
    "current_url": "http://127.0.0.1/settings"
  },
  "scenario2_enabled_changed": {
    "description": "After updating enabled signal to false",
    "enabled_signal": false,
    "minute_signal": 30,
    "route_matches": true,
    "current_url": "http://127.0.0.1/settings?enabled=false"
  },
  "scenario3_minute_changed": {
    "description": "After updating minute signal to 45",
    "enabled_signal": false,
    "minute_signal": 45,
    "route_matches": true,
    "current_url": "http://127.0.0.1/settings?enabled=false&minute=45"
  },
  "scenario4_both_changed": {
    "description": "After updating both signals together",
    "enabled_signal": true,
    "minute_signal": 60,
    "route_matches": true,
    "current_url": "http://127.0.0.1/settings?minute=60"
  },
  "url_progression": [
    "http://127.0.0.1/settings",
    "http://127.0.0.1/settings?enabled=false",
    "http://127.0.0.1/settings?enabled=false&minute=45",
    "http://127.0.0.1/settings?minute=60"
  ],
  "signals_reflect_in_urls": {
    "initial_url_contains_enabled_true": false,
    "initial_url_contains_minute_30": false,
    "after_enabled_false": true,
    "enabled_change_preserves_minute": false,
    "after_minute_45": true,
    "minute_change_preserves_enabled": true,
    "final_enabled_true": false,
    "final_minute_60": true
  },
  "explanation": {
    "purpose": "Test bidirectional sync: Signal→URL direction with multiple parameters",
    "behavior": "Each signal update should rebuild URL with new values while preserving others",
    "use_case": "Settings page where user changes multiple preferences independently"
  }
}
```

---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
