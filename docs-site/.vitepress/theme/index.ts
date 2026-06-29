import DefaultTheme from 'vitepress/theme'
import type { Theme } from 'vitepress'
import './style.css'

// PostHog integration (client-side only)
const theme: Theme = {
  extends: DefaultTheme,
  enhanceApp({ app, router }) {
    // Only initialize PostHog on client-side (not during SSR)
    if (typeof window !== 'undefined') {
      import('posthog-js').then(({ default: posthog }) => {
        // Read config from Vite env vars
        const apiKey = import.meta.env.VITE_POSTHOG_KEY || 'phc_PLACEHOLDER_KEY_SET_VITE_POSTHOG_KEY_IN_ENV'
        const host = import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com'
        
        posthog.init(apiKey, {
          api_host: host,
          autocapture: true,
          capture_pageview: true,
        })
        
        // Track route changes
        router.onAfterRouteChanged = (to) => {
          posthog.capture('$pageview', { path: to })
        }
      })
    }
  },
}

export default theme
