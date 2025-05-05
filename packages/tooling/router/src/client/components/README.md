# Form Submission User Experience Guide

## State Management During Form Submissions

When users interact with forms, three different states exist simultaneously:

1. **UI State**: What the user sees (the desired/modified state)
2. **Frontend Memory State**: Client-side state (typically in Preact signals) that still reflects server data
3. **Backend State**: The current persisted data on the server

## Recommended User Experience Flow

When Form Is Submitted

1. **Preserve UI State**: Maintain the user's inputs in the interface
2. **Disable Interaction**: Prevent further input while processing the request
3. **Show Loading Indicator**: Display a spinner near the submit button
   > Note: This may be unnecessary as browsers indicate loading state

If Request Fails

When `form.pending` becomes `false` after failure:

- **Re-enable UI**: Allow user interaction again
- **Remove Loading Indicators**: Clear any spinners/loading states
- **Revert UI**: Reset display to match frontend memory state by setting `UIStateRef.current = undefined`
- **Preserve Frontend State**: No need to update client-side state model

If Request Succeeds

When `form.pending` becomes `false` after success:

- **Re-enable UI**: Allow user interaction again
- **Remove Loading Indicators**: Clear any spinners/loading states
- **Update Frontend State**: Sync client-side state with server response
- **Automatic UI Consistency**:
  - In most cases, UI already reflects the server state
  - If server returns modified data, UI will update accordingly

See [./use_ui_or_frontend_state.js](./use_ui_or_frontend_state.js)
