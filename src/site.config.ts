import type { SiteConfig } from '@types'

const config: SiteConfig = {
  // Absolute URL to the root of your published site, used for generating links and sitemaps.
  site: 'https://hamzamasood.dev',
  // The name of your site, used in the title and for SEO.
  title: 'Hamza Masood',
  // The description of your site, used for SEO and RSS feed.
  description:
    'Long-form walkthroughs of OAuth, Kubernetes and cloud-native infrastructure, by Hamza Masood.',
  // The author of the site, used in the footer, SEO, and RSS feed.
  author: 'Hamza Masood',
  // Keywords for SEO, used in the meta tags.
  // Keywords for SEO, used in the meta tags.
  tags: ['OAuth', 'Kubernetes', 'Cloud Native', 'DevOps', 'Platform Engineering'],
  // Path to the image used for generating social media previews.
  // Needs to be a square JPEG file due to limitations of the social card generator.
  // Try https://squoosh.app/ to easily convert images to JPEG.
  socialCardAvatarImage: './src/content/avatar.jpg',
  // Font imported from @fontsource or elsewhere, used for the entire site.
  // To change this see src/styles/global.css and import a different font.
  font: 'JetBrains Mono Variable',
  // For pagination, the number of posts to display per page.
  // The homepage will display half this number in the "Latest Posts" section.
  pageSize: 6,
  // Whether Astro should resolve trailing slashes in URLs or not.
  // This value is used in the astro.config.mjs file and in the "Search" component to make sure pagefind links match this setting.
  // It is not recommended to change this, since most links existing in the site currently do not have trailing slashes.
  trailingSlashes: false,
  // The navigation links to display in the header.
  navLinks: [
    {
      name: 'Home',
      url: '/',
    },
    {
      name: 'About',
      url: '/about',
    },
    {
      name: 'Archive',
      url: '/posts',
    },
    {
      name: 'GitHub',
      url: 'https://github.com/hamza-m-masood',
      external: true,
    },
  ],
  // The theming configuration for the site.
  themes: {
    // The theming mode. One of "single" | "select" | "light-dark-auto".
    mode: 'select',
    // The default theme identifier, used when themeMode is "select" or "light-dark-auto".
    // Make sure this is one of the themes listed in `themes` or "auto" for "light-dark-auto" mode.
    default: 'catppuccin-mocha',
    // Shiki themes to bundle with the site.
    // https://expressive-code.com/guides/themes/#using-bundled-themes
    // These will be used to theme the entire site along with syntax highlighting.
    // To use light-dark-auto mode, only include a light and a dark theme in that order.
    // include: [
    //   'github-light',
    //   'github-dark',
    // ]
    include: [
      'catppuccin-mocha',
      'catppuccin-latte',
      'github-dark-default',
      'github-light-default',
      'dracula',
      'everforest-dark',
      'everforest-light',
      'gruvbox-dark-medium',
      'gruvbox-light-medium',
      'nord',
      'rose-pine',
      'tokyo-night',
    ],
  },
  // Social links to display in the footer.
  socialLinks: {
    github: 'https://github.com/hamza-m-masood',
    linkedin: 'https://www.linkedin.com/in/hamza-m-masood/',
    bluesky: 'https://bsky.app/profile/hamzamasood.bsky.social',
    twitter: 'https://x.com/hamzamasoodx',
  },
  // Configuration for Giscus comments.
  // To set up Giscus, follow the instructions at https://giscus.app/
  // You'll need a GitHub repository with discussions enabled and the Giscus app installed.
  // Take the values from the generated script tag at https://giscus.app and fill them in here.
  // IMPORTANT: Update giscus.json in the root of the project with your own website URL
  // If you don't want to use Giscus, set this to undefined.
  giscus: {
    repo: 'hamza-m-masood/multiterm-astro',
    repoId: 'R_kgDOPSQyAA',
    category: 'Giscus',
    categoryId: 'DIC_kwDOPSQyAM4CuarU',
    reactionsEnabled: true, // Enable reactions on post itself
  },
  // These are characters available for the character chat feature.
  // To add your own character, add an image file to the top-level `/public` directory
  // Make sure to compress the image to a web-friendly size (<100kb)
  // Try using the excellent https://squoosh.app web app for creating small webp files
  characters: {
    owl: '/owl.webp',
    unicorn: '/unicorn.webp',
    duck: '/duck.webp',
    me: '/me.webp',
    equationme: '/equationme.webp',
    magnifyingglassme: '/magnifyingglassme.webp',
    strongme: '/strongme.webp',
    joyfulDuck: '/joyfulDuck.webp',
    attackerDuck: `/attackerDuck.webp`,
    confusedDuck: '/confusedDuck.webp',
    sweatingDuck: '/sweatingDuck.webp',
  },
}

export default config
