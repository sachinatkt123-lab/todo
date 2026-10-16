/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      keyframes: {
        bounceIn: {
          '0%': { transform: 'scale(0.6) translateY(12px)', opacity: '0' },
          '60%': { transform: 'scale(1.06) translateY(-4px)', opacity: '1' },
          '80%': { transform: 'scale(0.97) translateY(1px)' },
          '100%': { transform: 'scale(1) translateY(0)', opacity: '1' },
        },
      },
      animation: {
        bounceIn: 'bounceIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) both',
      },
    },
  },
  plugins: [],
};
