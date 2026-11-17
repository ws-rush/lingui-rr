# API Reference

This page contains the signatures, parameters, and descriptions for all exported functions and hooks in `lingui-rr`.

---

## Core Factories

### `createLinguiRouter`

Instantiates a Lingui-React Router integration router.

```ts
function createLinguiRouter(config: LinguiRouterConfig): LinguiRouter
```

- **Parameters**: `config` (see [Configuration Reference](./configuration)).
- **Returns**: A router instance used by the middleware, loaders, and actions. Do not consume this instance directly in UI rendering; access it via hooks.

### `validateConfig`

Validates and normalizes a `LinguiRouterConfig`, returning a `LinguiRouter` instance. Called internally by `createLinguiRouter`.

```ts
function validateConfig(config: LinguiRouterConfig): LinguiRouter
```

---

## Route Middleware & Loaders

### `createLinguiMiddleware`

Creates a server-side middleware function to run in the root route's `middleware` pipeline. Intended for `server: true` root routes.

```ts
function createLinguiMiddleware(
  router: LinguiRouter,
): MiddlewareFunction<Response>
```

### `createLinguiClientMiddleware`

Creates a client-side middleware function for client-only / SPA builds. Intended for `server: false` root routes.

```ts
function createLinguiClientMiddleware(
  router: LinguiRouter,
): MiddlewareFunction<Record<string, DataStrategyResult>>
```

### `createLinguiRootLoader`

Creates the root route loader function. It reads the state populated by middleware from context and returns a serializable state tree.

```ts
function createLinguiRootLoader(router: LinguiRouter): LoaderFunction
```

- **Returns**: A loader function. In your route files, type your layout hook as `useLoaderData<typeof loader>()` or `useRouteLoaderData<typeof loader>('root')` to resolve to the type-safe `LinguiState` shape.

### `loadLinguiState`

Matches `locale` against the router's supported locales, loads its translation catalog, and returns the `LinguiState` object.

```ts
function loadLinguiState(
  router: LinguiRouter,
  locale: string,
): Promise<LinguiState>
```

### `linguiRouterContext`

React Router context used internally by the middleware and root loader to pass `LinguiState`.

```ts
const linguiRouterContext: RouterContext<LinguiState | null>
```

---

## Actions & Optional Revalidation

### `createLocaleAction`

Creates an action route handler to process locale updates.

```ts
function createLocaleAction(router: LinguiRouter): ActionFunction
```

- **Expected Request Payload**:
  - `locale`: The code of the target locale to switch to.
  - `redirectTo`: The path to redirect to after persisting the selection.
- **Returns**: A response directing the browser to the redirected path with updated cookie/session headers.

### `createLinguiShouldRevalidate`

Creates an optional React Router `shouldRevalidate` guardrail for locale-switch submissions.

```ts
function createLinguiShouldRevalidate(
  router: LinguiRouter,
  options?: { actionPath?: string },
): ShouldRevalidateFunction
```

- **Options**:
  - `actionPath`: The route path of your locale action (defaults to `DEFAULT_LOCALE_ACTION_PATH`, `"/change-locale"`).
- **Behavior**: Most React Router v8 apps do not need to export this helper because action submissions revalidate by default. If you do export it, it returns `true` when a submission is sent to `actionPath`, even if that submission redirects back to the same URL. All other navigations and submissions defer to React Router's `defaultShouldRevalidate`, so v8 call-site controls like `<Form defaultShouldRevalidate={false}>`, `<Link defaultShouldRevalidate={false}>`, `useSubmit(...)`, and `fetcher.submit(...)` continue to work.

### `DEFAULT_LOCALE_ACTION_PATH`

Default route path (`"/change-locale"`) used by `createLinguiShouldRevalidate`.

```ts
const DEFAULT_LOCALE_ACTION_PATH = '/change-locale'
```

---

## React Providers & Hooks

### `LinguiRouterProvider`

Hydrates the client-side Lingui provider with translation catalogs and configures the active locale context. Wrap your root layout component with this provider.

```tsx
function LinguiRouterProvider(props: {
  state: LinguiState
  children: React.ReactNode
}): React.JSX.Element
```

- **Props**:
  - `state`: The serialized Lingui state returned from your root loader (type `LinguiState`).
  - `children`: Component subtree that needs access to translation context and macros (e.g. `<Trans>`).

### `useLinguiRouter`

Reads active localization metadata and routing parameters. Must be invoked within a component wrapped by `LinguiRouterProvider`.

```ts
function useLinguiRouter(): {
  locale: string
  localeMeta: { code: string; label: string; dir: 'ltr' | 'rtl' | 'auto' }
  locales: Array<{ code: string; label: string; dir: 'ltr' | 'rtl' | 'auto' }>
  messages: Messages
  htmlAttrs: { lang: string; dir: 'ltr' | 'rtl' | 'auto' }
}
```

---

## Path Rewriting & Utilities

### `rewriteLocalePath`

Pure function that rewrites absolute URL paths to target a specific locale prefix.

```ts
function rewriteLocalePath(
  path: string,
  targetLocale: string,
  supportedLocales: readonly string[],
  options?: {
    defaultLocale?: string
    prefixDefaultLocale?: boolean
    ignorePaths?: Array<RegExp | string>
  },
): string
```

- **Parameters**:
  - `path`: Absolute URL path (e.g. `/dashboard?tab=1#main`).
  - `targetLocale`: The locale to apply to the prefix (matched case-insensitively).
  - `supportedLocales`: Array of configured locale codes.
  - `options`: If omitting the prefix for the default locale, supply `defaultLocale` and set `prefixDefaultLocale: false`. If a path matches `ignorePaths`, it is returned unchanged.

```ts
rewriteLocalePath('/about', 'en', ['en', 'ar']) // "/en/about"
rewriteLocalePath('/en/about', 'ar', ['en', 'ar'], {
  defaultLocale: 'ar',
  prefixDefaultLocale: false,
}) // "/about"
```

### `getHtmlAttrs`

Generates lang/direction attributes for a specific locale.

```ts
function getHtmlAttrs(
  locale: string | LocaleMeta,
  locales?: readonly LocaleMeta[],
): { lang: string; dir: 'ltr' | 'rtl' | 'auto' }
```

### `getLocaleDir`

Resolves the rendering direction for a locale.

```ts
function getLocaleDir(
  locale: string | LocaleMeta,
  locales?: readonly LocaleMeta[],
): 'ltr' | 'rtl' | 'auto'
```

### `getLocaleLabel`

Resolves the human-readable label of a locale.

```ts
function getLocaleLabel(
  locale: string | LocaleMeta,
  locales?: readonly LocaleMeta[],
): string
```

### `normalizeLocaleCode`

Normalizes a BCP 47 locale code to canonical casing (e.g. `'en-us'` → `'en-US'`, `'zh-hans-cn'` → `'zh-Hans-CN'`).

```ts
function normalizeLocaleCode(locale: string): string
```

### `matchSupportedLocale`

Matches a candidate locale against `supportedLocales` (exact, progressive subtag, then base language), returning `fallbackLocale` when no match is found.

```ts
function matchSupportedLocale(
  candidate: string | null | undefined,
  supportedLocales: readonly string[],
  fallbackLocale: string,
): string
```

### `serializeCookie`

Serializes a cookie string with `Path` (default `'/'`), `Max-Age`, `SameSite`, `Secure`, `HttpOnly`, and `Domain` attributes.

```ts
function serializeCookie(
  name: string,
  value: string,
  options?: CookieOptions,
): string
```

### `safeRedirectPath`

Sanitizes a redirect target to a relative path starting with `'/'`, returning `'/'` for external URLs or protocol-relative paths.

```ts
function safeRedirectPath(path: string): string
```
