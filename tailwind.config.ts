import type { Config } from "tailwindcss";

const config = {
  darkMode: ["class"],
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
  prefix: "",
} as const satisfies Config;

export default config;
