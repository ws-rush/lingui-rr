// Auto-generated fixture.
import { type RouteConfig, index, route } from '@react-router/dev/routes'

export default [
  route(':lang?', 'routes/layout.tsx', [
    index('routes/home.tsx'),
    route('about', 'routes/about.tsx'),
  ]),
  route('change-locale', 'routes/change-locale.ts'),
  route('api/data', 'routes/api.data.tsx'),
] satisfies RouteConfig
