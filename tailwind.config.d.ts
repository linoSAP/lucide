declare const _default: {
    darkMode: ["class"];
    content: string[];
    theme: {
        extend: {
            colors: {
                background: string;
                foreground: string;
                card: {
                    DEFAULT: string;
                    foreground: string;
                };
                muted: {
                    DEFAULT: string;
                    foreground: string;
                };
                border: string;
                input: string;
                ring: string;
                positive: string;
                warning: string;
                negative: string;
                primary: string;
                secondary: string;
            };
            borderRadius: {
                lg: string;
                md: string;
                sm: string;
            };
            boxShadow: {
                soft: string;
            };
            fontFamily: {
                sans: [string, string, string, string, string];
                mono: [string, string, string, string];
            };
            keyframes: {
                "fade-up": {
                    "0%": {
                        opacity: string;
                        transform: string;
                    };
                    "100%": {
                        opacity: string;
                        transform: string;
                    };
                };
            };
            animation: {
                "fade-up": string;
            };
        };
    };
    plugins: any[];
};
export default _default;
