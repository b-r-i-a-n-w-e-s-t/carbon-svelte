import carbonSveltePlugin from './src/lib/tailwind.js'

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{html,js,svelte,ts}'],
  theme: {
    extend: {},
  },
  plugins: [carbonSveltePlugin],
}
