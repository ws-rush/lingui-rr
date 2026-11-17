import { useLingui } from '@lingui/react'
import { Form, Link, useLocation } from 'react-router'
import { useLinguiRouter } from 'lingui-rr'
import { localizePath } from '../lib/i18n'

export default function Home() {
  const { _ } = useLingui()
  const { locale, localeMeta } = useLinguiRouter()
  const location = useLocation()
  return (
    <main>
      <h1 data-testid="greeting">{_('greeting')}</h1>
      <p data-testid="locale">{locale}</p>
      <p data-testid="dir">{localeMeta.dir}</p>
      <nav>
        <Link data-testid="about-link" to={localizePath('/about', locale)}>
          {_('aboutLink')}
        </Link>
      </nav>
      <Form method="post" action="/change-locale" data-testid="switch-form">
        <input name="redirectTo" type="hidden" value={location.pathname} />
        <button data-testid="switch-en" name="locale" type="submit" value="en">English</button>
        <button data-testid="switch-ar" name="locale" type="submit" value="ar">العربية</button>
      </Form>
    </main>
  )
}
