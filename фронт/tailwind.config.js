/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      colors: {
        panel: '#0c0c0e',
        card: '#121215',
        input: '#151518',
        border: 'rgba(255, 255, 255, 0.1)',
        'border-strong': 'rgba(255, 255, 255, 0.18)',
      },
    },
  },
  plugins: [],
};
