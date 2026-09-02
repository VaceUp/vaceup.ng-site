/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        vaceup: {
          teal: '#008B8B',
          gold: '#F4C430',
          navy: '#0A1128',
        },
      },
    },
  },
  plugins: [],
};