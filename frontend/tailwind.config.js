/** @type {import('tailwindcss').Config} */
/**
 * NOTE: This project uses Tailwind CSS v4 with CSS-first configuration.
 * The ACTIVE design tokens live in src/app/globals.css (@theme block).
 * This file is kept aligned for editor tooling only — do not add colors here.
 * Brand: Navy #00088A · Teal #008B8B · Gold #FFC72C · White #FFFFFF
 */
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
          gold: '#FFC72C',
          navy: '#00088A',
          ink: '#0A1128',
        },
      },
    },
  },
  plugins: [],
};
