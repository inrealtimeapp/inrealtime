/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  safelist: [
    {
      pattern:
        /(bg|text|stroke|fill|border|ring)-(neutral|red|yellow|green|blue|purple|pink|emerald|teal|cyan)-(50|100|200|300|400|500|600|700|800|900)/,
    },
  ],
  darkMode: 'class',
  theme: {
    extend: {},
  },
  plugins: [],
}
