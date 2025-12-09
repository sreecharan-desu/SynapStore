/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                brand: {
                    DEFAULT: '#3AA18A',            // brand
                    primary: '#3AA18A',            // same as DEFAULT
                    'primary-dark': '#2E7D73',
                    'primary-light': '#79D3B6',
                    'pale': '#E6F6F1',
                    'highlight': '#F6C867'
                },
                background: {
                    page: '#FFFFFF',
                    card: '#E6F6F1'
                },
                text: {
                    DEFAULT: '#374151',
                    muted: '#6B7280'
                },
                border: '#E5E7EB'
            },
        },
    },
    plugins: [],
}
