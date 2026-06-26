# Lesson 3: SSR with Context Mode

In this lesson, you will learn how to configure `lingui-rr` for a **Server-Side Rendered (SSR)** application where the locale is stored in state (like a cookie or session) instead of being prefixed in the URL paths. Under this configuration, `/about` stays `/about` regardless of the language.

---

## Step 1: Configure the Router `i18n` Object

Set `mode: 'context'` in your router configuration. This tells the middleware to skip URL-rewriting and path-prefix validation. The active locale is resolved solely from your detectors.

```ts
// app/lib/i18n.ts
import {
  createLinguiRouter,
  serverDetectors,
  serverPersistence,
} from 'lingui-rr'

export const locales = ['en', 'ar']
export const defaultLocale = 'en'

export const i18n = createLinguiRouter({
  server: true, // SSR Mode
  mode: 'context', // Clean URLs (no prefix) [!code hl]
  locales,
  defaultLocale,
  detection: [
    serverDetectors.cookie('locale'),
    serverDetectors.acceptLanguage(),
  ],
  persistence: [serverPersistence.cookie('locale')],
  ignorePaths: [
    /^\/assets\//,
    /^\/build\//,
    /^\/favicon\.ico$/,
    /^\/robots\.txt$/,
  ],
  catalogs: {
    en: () => import('../locales/en.po'),
    ar: () => import('../locales/ar.po'),
  },
})
```

---

## Step 2: Wire the Root Route (`root.tsx`)

Wiring up `root.tsx` is similar to URL-Prefix mode: export the middleware and loader.

```tsx
// app/root.tsx
import {
  createLinguiMiddleware, // [!code focus]
  createLinguiRootLoader, // [!code focus]
  LinguiRouterProvider, // [!code focus]
} from 'lingui-rr'
import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteLoaderData,
} from 'react-router'
import { i18n } from './lib/i18n'

export const middleware = [createLinguiMiddleware(i18n)] // [!code focus]
export const loader = createLinguiRootLoader(i18n) // [!code focus]

export function Layout({ children }: { readonly children: React.ReactNode }) {
  const lingui = useRouteLoaderData<typeof loader>('root') // [!code focus]

  return (
    <html
      lang={lingui?.locale ?? 'en'} // [!code focus]
      dir={lingui?.htmlAttrs.dir ?? 'ltr'} // [!code focus]
      suppressHydrationWarning
    >
      <head>
        <meta charSet="utf-8" />
        <meta content="width=device-width, initial-scale=1" name="viewport" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  )
}

export default function App() {
  const lingui = useLoaderData<typeof loader>() // [!code focus]

  return (
    <LinguiRouterProvider state={lingui} /* [!code focus] */>
      <Outlet />
    </LinguiRouterProvider> // [!code focus]
  )
}
```

---

## Step 3: Revalidation in Context Mode

When a user switches their language in URL-Prefix mode (e.g. from `/about` to `/en/about`), the URL path changes. React Router detects this path change and runs the active loaders, including the root loader that returns the language catalog.

In **Context Mode**, switching the language updates the cookie while the URL can remain exactly the same (`/about`). React Router v8 revalidates after action submissions by default, so a standard locale-switching `<Form method="post" action="/change-locale">` works without a custom route-level `shouldRevalidate`.

`createLinguiShouldRevalidate(i18n)` is optional. Add it only if you want a route-level guardrail that always revalidates after submissions to the locale-switching action route (default `/change-locale`):

```tsx
import { createLinguiShouldRevalidate } from 'lingui-rr'

export const shouldRevalidate = createLinguiShouldRevalidate(i18n)
```

For every non-locale action/navigation, the helper defers to React Router's `defaultShouldRevalidate` value. That means v8 call-site opt-outs still work:

```tsx
<Form method="post" action="/local-mutation" defaultShouldRevalidate={false} />
```

Do **not** set `defaultShouldRevalidate={false}` on your locale-switching form unless you also handle refreshing the Lingui root loader yourself.
