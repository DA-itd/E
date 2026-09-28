/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'itd-navy': '#1B396A',
        'itd-navyDark': '#122a4d',
        'itd-guinda': '#9D2449',
        'itd-guindaDark': '#781834',
        'itd-guindaDeep': '#531023',
        'itd-gold': '#C9A227',
        'itd-sand': '#F7F5F0',
      },
      fontFamily: {
        display: ['Fraunces', 'serif'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
