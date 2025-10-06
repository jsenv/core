# UI State Controller

The UI State Controller solves a fundamental problem in web applications: managing the relationship between what the user sees (UI state) and what the application knows (external state).

## The Problem

Traditional approaches have limitations:

1. **React limitations** - No built-in way to revert UI state back to external state when needed
2. **Form limitations** - Regular forms can't do immediate server calls (like PATCH) for instant feedback
3. **UX trade-offs** - You're forced to choose between immediate feedback OR traditional form workflow

## The Solution

UI State Controller introduces clear separation:

- **External State**: The "source of truth" (props, backend data)
- **UI State**: What the user currently sees and interacts with
- **Controller**: Manages the relationship between them

There are **two distinct usage patterns** depending on your needs:

## Pattern 1: UI with Action (Auto-revert on Error)

For interactive components that need immediate feedback with server synchronization:

```jsx
const [savedValue, setSavedValue] = useState(false);

<InputCheckbox
  checked={savedValue} // External state
  action={async (newValue) => {
    // PATCH to update existing resource
    const response = await fetch("/api/user/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ emailNotifications: newValue }),
    });
    const result = await response.json();
    setSavedValue(result.emailNotifications);
  }}
/>;
```

**How it works:**

1. User clicks checkbox → UI updates immediately (responsive)
2. Action executes in background
3. **Success**: External state updates, UI stays in sync
4. **Error**: UI automatically reverts to match external state (auto-revert)

**Use when:** You want immediate feedback with automatic error recovery.

## Pattern 2: UI within `<form>` (User Choice on Error)

For traditional form workflows where users control submission:

```jsx
<Form
  action={async ({
    email,
    consent, // will be either undefined or "on", "on" can be customized by passing value="toto" to the checkbox
  }) => {
    const response = await fetch("/api/user/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email,
        consent,
      }),
    });
    if (!response.ok) {
      throw new Error("Failed to save settings");
    }
    // Update your app state here
    const result = await response.json();
    updateUserSettings(result);
  }}
>
  <label>
    Email Address:
    <Input type="email" name="email" defaultValue="user@example.com" required />
  </label>

  <label>
    <InputCheckbox name="consent" />I agree to receive marketing emails
  </label>

  <button type="submit">Save Settings</button>
  <button type="reset">Reset Form</button>
</Form>
```

**Key differences:**

- **Form submission errors**: UI state is NOT reverted
- **Reasoning**: User might want to fix the issue and re-submit as-is
- **Form reset**: UI state is properly restored to original values
- **Navigation**: Form state persists during page navigation

**Use when:** You want traditional form behavior with user control over submission.

## When to Use Each Pattern

### Use Action Pattern When:

- Building interactive dashboards or real-time interfaces
- Each change should be immediately persisted
- You want automatic error recovery
- User expects instant feedback

### Use Form Pattern When:

- Building traditional forms with submit/reset workflow
- Users need to make multiple changes before saving
- You want standard form validation behavior
- Users should control when changes are persisted

## Advanced APIs

### Tracking State Changes

Use `onUIStateChange` to track what the user has selected (like in our demo). This can be useful for showing what would be submitted/reset, though it's not always needed:

```jsx
const [colorChoices, setColorChoices] = useState([
  { id: 1, color: "red", selected: true },
  { id: 2, color: "blue", selected: false },
  { id: 3, color: "green", selected: true },
]);

// What's currently saved
const selectedColors = colorChoices
  .filter((choice) => choice.selected)
  .map((choice) => choice.color);

// What user has selected in UI (may differ)
const [uiSelectedColors, setUiSelectedColors] = useState(selectedColors);

<Form action={submitColorPreferences}>
  <CheckboxList
    name="colors"
    onUIStateChange={(colors) => {
      // Track what user has selected
      setUiSelectedColors(colors);
      // Can be used for UI feedback or internal logic
    }}
  >
    {colorChoices.map(({ id, color }) => (
      <Label key={id}>
        {color}
        <Checkbox value={color} checked={selectedColors.includes(color)} />
      </Label>
    ))}
  </CheckboxList>

  <button type="submit">Submit ({uiSelectedColors.join(", ")})</button>
  <button type="reset">Reset to saved ({selectedColors.join(", ")})</button>
</Form>;
```

### External Control via Custom Events

Programmatically control UI state from outside the component:

```jsx
// Set UI state externally
const checkbox = document.querySelector("#my-checkbox");
checkbox.dispatchEvent(
  new CustomEvent("setuistate", {
    detail: { value: true },
  }),
);

// Reset UI state to match external state
checkbox.dispatchEvent(new CustomEvent("resetuistate"));
```

### Error Recovery Patterns

```jsx
<InputCheckbox
  checked={savedValue}
  action={updateServer}
  onActionError={(error) => {
    // UI already reverted automatically
    showErrorMessage("Failed to save: " + error.message);
  }}
  onActionAbort={() => {
    // UI reverted when action was cancelled
    console.log("Action was cancelled");
  }}
/>
```

### Group Controllers (Checkbox Lists)

Coordinate multiple related inputs:

```jsx
const [selectedOptions, setSelectedOptions] = useState([]);

<CheckboxList
  values={selectedOptions} // External state
  onUIStateChange={(uiState) => {
    // Track what user has selected (internal use)
    console.log("Currently selected:", uiState);
  }}
  action={async (newValues) => {
    const response = await fetch("/api/options", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedOptions: newValues }),
    });
    const result = await response.json();
    setSelectedOptions(result.selectedOptions);
  }}
>
  <InputCheckbox value="option1" />
  <InputCheckbox value="option2" />
  <InputCheckbox value="option3" />
</CheckboxList>;
```

**Group features:**

- Aggregates individual checkbox states into arrays
- Coordinate reset operations across all children
- Single action handles all checkbox changes

## Key Benefits

- **Instant feedback**: UI updates immediately, no lag
- **Flexible error handling**: Auto-revert for actions, user choice for forms
- **Form compatibility**: Works seamlessly with native form behavior
- **External control**: Programmatic state control when needed
- **Group coordination**: Multiple inputs work together naturally

## Summary

Choose the pattern that fits your use case:

- **Action pattern**: For immediate persistence with auto-revert
- **Form pattern**: For traditional submit/reset workflows with user control

Both patterns provide responsive UI while maintaining data consistency.
