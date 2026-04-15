import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'BotAS',
  description: 'Multi-language Microsoft Teams bot library documentation',
  base: '/botas/',
  appearance: 'dark',

  head: [
    ['link', { rel: 'icon', href: '/botas/logo.svg' }],
  ],

  themeConfig: {
    logo: '/logo.svg',

    nav: [
      { text: 'Home', link: '/' },
      { text: 'Getting Started', link: '/getting-started' },
      {
        text: 'Languages',
        items: [
          { text: '.NET', link: '/languages/dotnet' },
          { text: 'Node.js', link: '/languages/nodejs' },
          { text: 'Python', link: '/languages/python' },
        ],
      },
      { text: 'Teams Features', link: '/teams-features' },
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/getting-started' },
          { text: 'Authentication & Setup', link: '/auth-setup' },
          { text: 'Middleware', link: '/middleware' },
          { text: 'Teams Features', link: '/teams-features' },
          { text: 'Typing Indicators', link: '/typing-activity' },
        ],
      },
      {
        text: 'Languages',
        items: [
          { text: 'Overview', link: '/languages/' },
          { text: '.NET (C#)', link: '/languages/dotnet' },
          { text: 'Node.js (TypeScript)', link: '/languages/nodejs' },
          { text: 'Python', link: '/languages/python' },
        ],
      },
    ],

    socialLinks: [
      { icon: 'github', link: 'https://github.com/rido-min/botas' },
    ],

    search: {
      provider: 'local',
    },

    footer: {
      message: 'BotAS — Multi-language Microsoft Teams bot library',
    },
  },
})
