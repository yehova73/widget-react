# @snappa/widget-react

React component and hook for the Snappa feedback widget. The adapter loads the same versioned CDN module used by the script installation; it does not bundle a second widget runtime.

## Installation

```bash
npm install @snappa/widget-react react react-dom
```

React and React DOM are peer dependencies. The adapter loads:

```text
https://cdn.snappa.dev/widget/v1/snappa-widget.js
```

Render one `<SnappaWidget />` for a project on a page. Do not also add the CDN script tag manually.

## Add the widget

```tsx
import { SnappaWidget } from "@snappa/widget-react";

export function App() {
  return (
    <>
      <main>Your application</main>
      <SnappaWidget
        apiKey="YOUR_PROJECT_KEY"
        environment="production"
        userData={{
          id: "user-123",
          email: "user@example.com",
          name: "Jane Doe",
        }}
        customMetadata={{ plan: "team" }}
      />
    </>
  );
}
```

`SnappaWidget` loads the script after the component mounts in the browser and renders no React DOM of its own; the CDN widget mounts its UI into the page.
Its props are initialization-only. Use `useSnappa()` to update the user, environment, metadata, or visibility after mount.

### Props

| Prop | Required | Description |
| --- | --- | --- |
| `apiKey` | Yes | Browser-facing project key. Restrict it to the website origins where the widget should run. |
| `apiBaseUrl` | No | API base URL override. Defaults to `https://snappa.dev`. |
| `environment` | No | Environment label. Defaults to `default`. |
| `userData` | No | Initial reporter fields: `id`, `email`, `name`, and `image`. |
| `customMetadata` | No | Initial custom string metadata. |
| `defaultVisible` | No | Whether the trigger is initially visible. Defaults to `true`. |

The CDN script and its API are global and support one project/API base URL per page.

## Control the widget with the hook

```tsx
import { useSnappa } from "@snappa/widget-react";

export function FeedbackControls() {
  const {
    loaded,
    visible,
    showWidget,
    hideWidget,
    open,
    close,
    setUser,
    clearUser,
  } = useSnappa();

  return (
    <div>
      <button type="button" disabled={!loaded} onClick={showWidget}>
        Show feedback button
      </button>
      <button type="button" disabled={!loaded} onClick={hideWidget}>
        Hide feedback button
      </button>
      <button type="button" disabled={!loaded} onClick={() => open("screenshot")}>
        Report a problem
      </button>
      <button type="button" disabled={!loaded} onClick={close}>
        Close report
      </button>
      <button
        type="button"
        disabled={!loaded}
        onClick={() => setUser({ id: "user-123", email: "user@example.com" })}
      >
        Set reporter
      </button>
      <button type="button" disabled={!loaded} onClick={clearUser}>
        Clear reporter
      </button>
      <p>Widget visible: {visible ? "yes" : "no"}</p>
    </div>
  );
}
```

`useSnappa()` returns `loaded`, `loading`, `error`, `visible`, `user`, `environment`, and `customMetadata`, along with these methods:

- `showWidget()` / `hideWidget()` — show or hide the trigger without opening or closing the dialog.
- `open(mode?)` — open the report flow. Supported modes: `"simple"`, `"screenshot"`, `"video"`, `"speak"`, and `"select-element"`.
- `close()` — close the report dialog without hiding the trigger.
- `setUser(user)` / `clearUser()`
- `setEnvironment(environment)` / `clearEnvironment()`
- `setCustomMetadata(metadata)` / `clearCustomMetadata()`

API methods throw if called before the CDN API is available. Disable host controls until `loaded` is true. `error` reports CDN script-load failures and widget initialization failures; `loading` remains true until the widget is ready.

## API events

The hook subscribes to Snappa's browser events and updates its returned state when reporter, environment, metadata, or trigger visibility changes. Event constants are exported if you need to subscribe directly:

```tsx
import {
  SNAPPA_USER_CHANGE_EVENT,
  SNAPPA_VISIBILITY_CHANGE_EVENT,
} from "@snappa/widget-react";

window.addEventListener(SNAPPA_USER_CHANGE_EVENT, (event) => {
  console.log((event as CustomEvent).detail);
});
```

Available event constants:

- `SNAPPA_USER_CHANGE_EVENT`
- `SNAPPA_VISIBILITY_CHANGE_EVENT`
- `SNAPPA_SHOW_EVENT`
- `SNAPPA_CLOSE_EVENT`
- `SNAPPA_READY_EVENT`
- `SNAPPA_ERROR_EVENT`
- `SNAPPA_ENVIRONMENT_CHANGE_EVENT`
- `SNAPPA_CUSTOM_METADATA_CHANGE_EVENT`

User, visibility, environment, and metadata change events include the updated value in `CustomEvent.detail`. The ready event fires after initialization; the error event carries the initialization error in `CustomEvent.detail`.

## Next.js

Render the component and use the hook from Client Components:

```tsx
"use client";

import { SnappaWidget } from "@snappa/widget-react";

export function FeedbackWidget() {
  return (
    <SnappaWidget
      apiKey={process.env.NEXT_PUBLIC_SNAPPA_PROJECT_KEY!}
      environment="production"
    />
  );
}
```

## Build locally

```bash
npm install
npm run build
```

The package build emits JavaScript and TypeScript declarations. React and React DOM remain external peer dependencies; the Snappa widget runtime is loaded from the CDN at runtime.
