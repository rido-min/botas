import DefaultTheme from 'vitepress/theme'
import { h } from 'vue'
import './style.css'
import versions from '../../versions.json'

/** Lightweight version badge rendered in the nav bar. */
function VersionBadge() {
  return h(
    'div',
    {
      class: 'version-badge',
      style: 'margin-left: 8px; padding: 2px 8px; font-size: 12px; border-radius: 6px; background: var(--vp-c-brand-soft); color: var(--vp-c-brand-1); font-weight: 600;',
    },
    `v${versions.current}`
  )
}

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-title-after': () => h(VersionBadge),
    })
  },
}
