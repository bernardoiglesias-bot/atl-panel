/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        marca: { 50: '#eef5fb', 100: '#d7e7f5', 600: '#1f4e79', 700: '#173d5e', 800: '#112d46' },
      },
    },
  },
  plugins: [],
}
