/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'darkahhblue': '#000957',
        'ahhblue': '#344CB7',
        'lightahhblue': '#577BC1',
        'ahhyellow': '#FFEB00',
      },
    },
  },
  plugins: [],
};
