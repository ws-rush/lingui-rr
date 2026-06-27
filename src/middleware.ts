import {
  redirect,
  type DataStrategyResult,
  type LoaderFunctionArgs,
  type MiddlewareFunction,
  type ShouldRevalidateFunction,
  type ShouldRevalidateFunctionArgs,
} from 'react-router'
import type { LinguiRouter, LinguiState, LinguiRootLoaderData } from './types'
import { matchSupportedLocale, appendDataSuffix } from './utils'
import { loadLinguiState, toLinguiRootLoaderData } from './state'
import { isIgnoredPath, rewriteLocalePath, looksLikeLocale } from './path'
import { linguiRouterContext } from './context'
import { runDetectors } from './detectors'

function getPathLocale(
  pathname: string,
  supportedLocales: readonly string[],
): {
  raw: string | null
  locale: string | null
  supported: boolean
  localeLike: boolean
} {
  const raw = pathname.split('/').find(Boolean) ?? null
  if (!raw) return { raw, locale: null, supported: false, localeLike: false }
  const matched = matchSupportedLocale(raw, supportedLocales, '')
  return {
    raw,
    locale: matched || null,
    supported: Boolean(matched),
    localeLike: looksLikeLocale(raw),
  }
}

function redirectResponse(location: string): Response {
  return redirect(location)
}

async function resolveDetectedLocale(
  router: LinguiRouter,
  request: Request,
): Promise<string> {
  return runDetectors(
    router.config.detection ?? [],
    { request },
    router.localeCodes,
    router.fallbackLocale,
  )
}

type ClientMiddlewareResult = Record<string, DataStrategyResult>
type LinguiMiddlewareFunction = MiddlewareFunction<
  Response | ClientMiddlewareResult
>
type LinguiMiddlewareArgs = Parameters<LinguiMiddlewareFunction>[0]
type LinguiMiddlewareNext = Parameters<LinguiMiddlewareFunction>[1]

type ParsedRequestPath = {
  pathname: string
  hrefPath: string
  isSingleFetch: boolean
}

function parseRequestPath(request: Request): ParsedRequestPath {
  const url = new URL(request.url)
  const isSingleFetch = url.pathname.endsWith('.data')
  const pathname = isSingleFetch ? url.pathname.slice(0, -5) : url.pathname
  return {
    pathname,
    hrefPath: `${pathname}${url.search}${url.hash}`,
    isSingleFetch,
  }
}

function methodAllowsRedirect(method: string): boolean {
  return method === 'GET' || method === 'HEAD'
}

function withSingleFetchSuffix(
  location: string,
  isSingleFetch: boolean,
): string {
  return isSingleFetch ? appendDataSuffix(location) : location
}

function rewritePathLocale(
  router: LinguiRouter,
  path: string,
  locale: string,
): string {
  return rewriteLocalePath(path, locale, router.localeCodes, {
    defaultLocale: router.defaultLocale,
    prefixDefaultLocale: router.config.prefixDefaultLocale,
    ignorePaths: router.config.ignorePaths,
  })
}

async function setLocaleState(
  router: LinguiRouter,
  args: LinguiMiddlewareArgs,
  locale: string,
): Promise<void> {
  const state = await loadLinguiState(router, locale)
  args.context.set(linguiRouterContext, state)
}

async function continueWithLocaleState(
  router: LinguiRouter,
  args: LinguiMiddlewareArgs,
  next: LinguiMiddlewareNext,
  locale: string,
): ReturnType<LinguiMiddlewareNext> {
  await setLocaleState(router, args, locale)
  return next()
}

function defaultLocalePrefixRedirect(
  router: LinguiRouter,
  requestPath: ParsedRequestPath,
  pathLocale: ReturnType<typeof getPathLocale>,
): Response | null {
  const hidesDefaultLocale = router.config.prefixDefaultLocale === false
  if (!hidesDefaultLocale || pathLocale.locale !== router.defaultLocale) {
    return null
  }

  const location = rewritePathLocale(
    router,
    requestPath.hrefPath,
    router.defaultLocale,
  )
  return redirectResponse(
    withSingleFetchSuffix(location, requestPath.isSingleFetch),
  )
}

async function handleCanonicalLocalePath(
  router: LinguiRouter,
  args: LinguiMiddlewareArgs,
  next: LinguiMiddlewareNext,
  requestPath: ParsedRequestPath,
  pathLocale: ReturnType<typeof getPathLocale>,
): ReturnType<LinguiMiddlewareNext> {
  if (methodAllowsRedirect(args.request.method)) {
    const redirectResult = defaultLocalePrefixRedirect(
      router,
      requestPath,
      pathLocale,
    )
    if (redirectResult) return redirectResult
  }

  return continueWithLocaleState(router, args, next, pathLocale.locale!)
}

async function handleMissingLocalePath(
  router: LinguiRouter,
  args: LinguiMiddlewareArgs,
  next: LinguiMiddlewareNext,
  requestPath: ParsedRequestPath,
  pathLocale: ReturnType<typeof getPathLocale>,
): ReturnType<LinguiMiddlewareNext> {
  const detectedLocale = await resolveDetectedLocale(router, args.request)
  const targetLocale = pathLocale.supported
    ? pathLocale.locale!
    : detectedLocale
  const location = rewritePathLocale(router, requestPath.hrefPath, targetLocale)

  const hidesDefaultLocale = router.config.prefixDefaultLocale === false
  const canContinueWithoutRedirect =
    hidesDefaultLocale &&
    targetLocale === router.defaultLocale &&
    location === requestPath.hrefPath

  if (
    canContinueWithoutRedirect ||
    !methodAllowsRedirect(args.request.method)
  ) {
    return continueWithLocaleState(router, args, next, targetLocale)
  }

  return redirectResponse(
    withSingleFetchSuffix(location, requestPath.isSingleFetch),
  )
}

function createLinguiMiddlewareImpl(
  router: LinguiRouter,
): LinguiMiddlewareFunction {
  return async (args, next) => {
    const requestPath = parseRequestPath(args.request)

    if (router.config.mode !== 'url-prefix') {
      const locale = await resolveDetectedLocale(router, args.request)
      return continueWithLocaleState(router, args, next, locale)
    }

    if (isIgnoredPath(requestPath.pathname, router.config.ignorePaths)) {
      return next()
    }

    const pathLocale = getPathLocale(requestPath.pathname, router.localeCodes)
    const hasCanonicalLocalePrefix =
      pathLocale.supported && pathLocale.raw === pathLocale.locale

    if (hasCanonicalLocalePrefix) {
      return handleCanonicalLocalePath(
        router,
        args,
        next,
        requestPath,
        pathLocale,
      )
    }

    return handleMissingLocalePath(router, args, next, requestPath, pathLocale)
  }
}

export function createLinguiMiddleware(
  router: LinguiRouter,
): MiddlewareFunction<Response> {
  return createLinguiMiddlewareImpl(router) as MiddlewareFunction<Response>
}

export function createLinguiClientMiddleware(
  router: LinguiRouter,
): MiddlewareFunction<ClientMiddlewareResult> {
  return createLinguiMiddlewareImpl(
    router,
  ) as MiddlewareFunction<ClientMiddlewareResult>
}

export function createLinguiRootLoader(_router: LinguiRouter) {
  return async ({
    context,
  }: LoaderFunctionArgs): Promise<LinguiRootLoaderData> => {
    const state = context.get<LinguiState | null>(linguiRouterContext)
    if (!state)
      throw new Error(
        'Lingui state was not found in React Router context. Did createLinguiMiddleware run before createLinguiRootLoader?',
      )
    return toLinguiRootLoaderData(state)
  }
}

export const DEFAULT_LOCALE_ACTION_PATH = '/change-locale'

export function createLinguiShouldRevalidate(
  _router: LinguiRouter,
  options: { actionPath?: string } = {},
): ShouldRevalidateFunction {
  const actionPath = (options.actionPath ?? DEFAULT_LOCALE_ACTION_PATH).replace(
    /\/$/,
    '',
  )
  return ({
    currentUrl,
    formAction,
    defaultShouldRevalidate,
  }: ShouldRevalidateFunctionArgs): boolean => {
    const formActionPathname = formAction
      ? new URL(formAction, currentUrl).pathname
      : null
    if (!formActionPathname) return defaultShouldRevalidate

    let cleanPath = formActionPathname.replace(/\/$/, '')
    if (cleanPath.endsWith('.data')) {
      cleanPath = cleanPath.slice(0, -5).replace(/\/$/, '')
    }

    const segments = cleanPath.split('/').filter(Boolean)
    const first = segments[0]
    if (first && matchSupportedLocale(first, _router.localeCodes, '')) {
      segments.shift()
    }
    const normalizedFormAction = `/${segments.join('/')}`

    if (normalizedFormAction === actionPath) return true
    return defaultShouldRevalidate
  }
}
