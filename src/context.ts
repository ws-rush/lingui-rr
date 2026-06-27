import { setupI18n } from '@lingui/core'
import { I18nProvider } from '@lingui/react'
import React, {
  createContext as createReactContext,
  useContext,
  useMemo,
  type ReactNode,
} from 'react'
import { createContext as createRouterContext } from 'react-router'
import type { LinguiState } from './types'

const localeContext = createReactContext<LinguiState | null>(null)
export const linguiRouterContext = createRouterContext<LinguiState | null>(null)

export function LinguiRouterProvider({
  state,
  children,
}: {
  state: LinguiState
  children: ReactNode
}) {
  const i18n = useMemo(() => {
    const instance = setupI18n()
    instance.load(state.locale, state.messages)
    instance.activate(state.locale)
    return instance
  }, [state.locale, state.messages])

  return React.createElement(
    localeContext.Provider,
    { value: state },
    React.createElement(I18nProvider, { i18n }, children),
  )
}

export function useLinguiRouter(): LinguiState {
  const state = useContext(localeContext)
  if (!state)
    throw new Error('useLinguiRouter must be used inside LinguiRouterProvider')
  return state
}
