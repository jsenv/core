/\*\*

- # Actions System - Declarative Resource Management for Frontend Applications
-
- This module provides a comprehensive system for managing asynchronous resources (API calls, data fetching)
- in a declarative, signal-based architecture. It's designed for complex frontend applications that need
- fine-grained control over loading states, caching, and resource lifecycle management.
-
- ## Core Concepts
-
- ### 🔧 **Action Templates**
- Factory functions that define how to load resources. Templates are pure and reusable.
- ```js

  ```

- const getUserTemplate = createActionTemplate(async ({ userId }) => {
- const response = await fetch(`/api/users/${userId}`);
- return response.json();
- });
- ```

  ```

-
- ### 🎯 **Action Instances**
- Stateful objects created from templates with specific parameters. Each unique parameter set
- gets its own cached instance (automatic memoization).
- ```js

  ```

- const userAction = getUserTemplate.instantiate({ userId: 123 });
- const status = useActionStatus(userAction); // { pending, data, error, ... }
- ```

  ```

-
- ### 🔄 **Action Proxies**
- Dynamic actions that react to signal changes, automatically reloading when parameters change.
- ```js

  ```

- const userProxy = createActionProxy(getUserTemplate, {
- userId: userIdSignal, // Signal - reactive
- includeProfile: true // Static - not reactive
- });
- // Automatically reloads when userIdSignal changes
- ```

  ```

-
- ## Loading States & Lifecycle
-
- ### 📊 **State Management**
- Each action has a well-defined state machine:
- - `IDLE` → `LOADING` → `LOADED` (success)
- - `IDLE` → `LOADING` → `FAILED` (error)
- - `IDLE` → `LOADING` → `ABORTED` (cancelled)
-
- ### ⚡ **Load Types**
- - **`.load()`** - Load with user intent (sets `loadRequested: true`)
- - **`.preload()`** - Background loading (sets `loadRequested: false`)
- - **`.reload()`** - Force reload even if already loaded
- - **`.unload()`** - Cancel loading and reset state
-
- ### 🛡️ **Preload Protection**
- Preloaded actions are protected from garbage collection for 5 minutes to ensure
- they remain available for components that may load later (e.g., via dynamic imports).
-
- ## Key Features
-
- ### 🧠 **Intelligent Memoization**
- - Actions with identical parameters share the same instance
- - Uses deep equality comparison with `compareTwoJsValues`
- - Supports `SYMBOL_IDENTITY` for fast recognition of "conceptually same" objects
- - Memory-efficient with automatic garbage collection
-
- ### 🔗 **Parameter Binding & Composition**
- ```js

  ```

- const baseAction = getUserTemplate.instantiate({ userId: 123 });
- const enrichedAction = baseAction.bindParams({ includeProfile: true });
- // Result: { userId: 123, includeProfile: true }
-
- // Supports objects, primitives, and signals
- const dynamicAction = baseAction.bindParams(filtersSignal);
- ```

  ```

-
- ### 🎮 **Concurrent Loading Control**
- - Prevents duplicate requests for same resource
- - Smart request deduplication and racing condition handling
- - Coordinated loading/unloading of multiple actions via `updateActions()`
-
- ### 🔧 **Side Effects & Cleanup**
- ```js

  ```

- const actionTemplate = createActionTemplate(callback, {
- sideEffect: (params, loadParams) => {
-     // Setup logic (analytics, subscriptions, etc.)
-     return () => {
-       // Cleanup logic - called on unload/abort
-     };
- }
- });
- ```

  ```

-
- ## Usage Patterns
-
- ### 🏗️ **Basic Resource Loading**
- ```js

  ```

- const getUserAction = createActionTemplate(async ({ userId }) => {
- return await api.getUser(userId);
- });
-
- // In component
- const userAction = getUserAction.instantiate({ userId: 123 });
- const { pending, data, error } = useActionStatus(userAction);
-
- useEffect(() => {
- userAction.load();
- }, []);
- ```

  ```

-
- ### 🔄 **Reactive Data Loading**
- ```js

  ```

- const searchProxy = createActionProxy(searchTemplate, {
- query: searchSignal,
- filters: filtersSignal
- });
- // Automatically reloads when signals change
- ```

  ```

-
- ### 📋 **Master-Detail Pattern**
- ```js

  ```

- const usersAction = getUsersTemplate.instantiate();
- const selectedUser = signal(null);
-
- const userDetailsProxy = createActionProxy(getUserTemplate, {
- userId: computed(() => selectedUser.value?.id)
- });
- ```

  ```

-
- ### 🏃 **Progressive Loading**
- ```js

  ```

- // Preload on hover, load on click
- <button
- onMouseEnter={() => action.preload()}
- onClick={() => action.load()}
- >
- Load User
- </button>
- ```

  ```

-
- ## Advanced Features
-
- ### 🎭 **Custom Data Transformation**
- ```js

  ```

- const actionTemplate = createActionTemplate(fetchUser, {
- computedDataSignal: computed(() => {
-     const rawData = dataSignal.value;
-     return rawData ? transformUser(rawData) : null;
- })
- });
- ```

  ```

-
- ### 🎨 **Async Rendering Support**
- ```js

  ```

- const actionTemplate = createActionTemplate(fetchData, {
- renderLoadedAsync: async () => {
-     const { UserComponent } = await import('./UserComponent.js');
-     return (user) => <UserComponent user={user} />;
- }
- });
- ```

  ```

-
- ### 🛠️ **Debugging & Observability**
- Built-in debug mode with detailed logging of state transitions, loading coordination,
- and memory management. Enable with `debug = true`.
-
- ## Integration Points
-
- - **Signals**: Built on @preact/signals for reactive state management
- - **Navigation**: Integrates with navigation systems for route-based loading
- - **Components**: Use `useActionStatus()` hook for component integration
- - **Memory Management**: Automatic cleanup with WeakMap-based private properties
-
- ## Performance Characteristics
-
- - **Memory Efficient**: Weak references prevent memory leaks
- - **Request Deduplication**: Identical requests are automatically merged
- - **Minimal Re-renders**: Signal-based updates only trigger when data actually changes
- - **Lazy Loading**: Actions only created when needed, with intelligent memoization
-
- This system is particularly well-suited for:
- - SPAs with complex data fetching requirements
- - Applications needing fine-grained loading state control
- - Systems requiring request coordination and deduplication
- - Progressive loading and preloading scenarios
- - Master-detail interfaces with dynamic parameter binding
    \*/
