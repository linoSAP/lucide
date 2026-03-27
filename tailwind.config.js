export default {
    darkMode: ["class"],
    content: ["./index.html", "./src/**/*.{ts,tsx}"],
    theme: {
        extend: {
            colors: {
                background: "rgb(var(--background) / <alpha-value>)",
                foreground: "rgb(var(--foreground) / <alpha-value>)",
                card: {
                    DEFAULT: "rgb(var(--card) / <alpha-value>)",
                    foreground: "rgb(var(--foreground) / <alpha-value>)",
                },
                muted: {
                    DEFAULT: "rgb(var(--muted) / <alpha-value>)",
                    foreground: "rgb(var(--muted-foreground) / <alpha-value>)",
                },
                border: "rgb(var(--border) / <alpha-value>)",
                input: "rgb(var(--input) / <alpha-value>)",
                ring: "rgb(var(--ring) / <alpha-value>)",
                positive: "rgb(var(--positive) / <alpha-value>)",
                warning: "rgb(var(--warning) / <alpha-value>)",
                negative: "rgb(var(--negative) / <alpha-value>)",
                primary: "rgb(var(--positive) / <alpha-value>)",
                secondary: "rgb(var(--secondary) / <alpha-value>)",
            },
            borderRadius: {
                lg: "var(--radius)",
                md: "calc(var(--radius) - 4px)",
                sm: "calc(var(--radius) - 8px)",
            },
            boxShadow: {
                soft: "0 18px 40px rgba(0, 0, 0, 0.18)",
            },
            fontFamily: {
                sans: ["Inter Variable", "Inter", "ui-sans-serif", "system-ui", "sans-serif"],
                mono: ["ui-monospace", "SFMono-Regular", "SFMono-Regular", "monospace"],
            },
            keyframes: {
                "fade-up": {
                    "0%": {
                        opacity: "0",
                        transform: "translateY(10px)",
                    },
                    "100%": {
                        opacity: "1",
                        transform: "translateY(0)",
                    },
                },
            },
            animation: {
                "fade-up": "fade-up 0.35s ease-out",
            },
        },
    },
    plugins: [],
};
