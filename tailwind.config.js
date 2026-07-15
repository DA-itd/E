/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        itd: {
          navy: '#1B396A',
          navyDark: '#122a4d',
          guinda: '#9D2449',
          gold: '#C9A227',
          sand: '#F7F5F0',
        },
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        sans: ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
