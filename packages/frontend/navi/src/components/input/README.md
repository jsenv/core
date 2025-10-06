# UI State Controller

The UI State Controller solves a fundamental problem in web applications: managing the relationship between what the user sees (UI state) and what the application knows (external state).

## The Problem

Traditional form handling creates challenges:

1. **Slow feedback** - waiting for server responses makes UI feel sluggish
2. **Error handling** - what happens when an action fails after the user sees the change?
3. **Form coordination** - how do multiple inputs work together?

## The Solution

UI State Controller introduces clear separation:

- **External State**: The "source of truth" (props, backend data)
- **UI State**: What the user currently sees and interacts with
- **Controller**: Manages the relationship between them

## Basic Usage - Checkbox with Action

For interactive components where actions can fail and need optimistic updates:

```jsx
const [savedValue, setSavedValue] = useState(false);

<InputCheckbox
  checked={savedValue} // External state
  action={async (newValue) => {
    // This might fail
    const result = await fetch("/api/update", {
      method: "POST",
      body: JSON.stringify({ checked: newValue }),
    });
    // Only update external state if successful
    setSavedValue(result.checked);
  }}
/>;
```

**How it works:**

1. User clicks checkbox → UI updates immediately (responsive)
2. Action executes in background
3. **Success**: External state updates, UI stays in sync
4. **Error**: UI automatically reverts to match external state

## Form Usage - Checkbox inside `<form>`

When using checkboxes inside forms, the behavior is different:

```jsx
<form action="/api/submit" method="post">
  <InputCheckbox name="notifications" value="email" />
  <InputCheckbox name="notifications" value="sms" />
  <button type="submit">Save Settings</button>
  <button type="reset">Reset Form</button>
</form>
```

**Key differences:**

- **Form submission errors**: UI state is NOT reverted
- **Reasoning**: User might want to fix the issue and re-submit as-is
- **Form reset**: UI state is properly restored to original values
- **Navigation**: Form state persists during page navigation

## Advanced APIs

### Tracking UI State Changes

Track what the user is doing in real-time:

```jsx
<InputCheckbox
  checked={savedValue}
  onUIStateChange={(uiState, event) => {
    console.log("User interaction:", uiState);
    // Track analytics, enable save buttons, etc.
  }}
  action={updateServer}
/>
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

### Group Controllers (Checkbox Lists)

Coordinate multiple related inputs:

```jsx
const [selectedOptions, setSelectedOptions] = useState([]);

<CheckboxList
  values={selectedOptions} // External state
  onUIStateChange={(uiState) => {
    // Track what user has selected
    console.log("Currently selected:", uiState);
  }}
  action={async (newValues) => {
    const result = await updateServerOptions(newValues);
    setSelectedOptions(result.options);
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

## Key Benefits

- **Instant feedback**: UI updates immediately, no lag
- **Reliable error handling**: Automatic recovery when actions fail
- **Form compatibility**: Works seamlessly with native form behavior
- **External control**: Programmatic state control when needed
- **Group coordination**: Multiple inputs work together naturally

## When to Use

- Interactive forms where immediate feedback matters
- Actions that can fail and need optimistic updates
- Complex forms with multiple related inputs
- Any scenario where UI responsiveness and data consistency both matter
