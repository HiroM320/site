import { defineConfig } from "astro/config";

import react from "@astrojs/react";
import vercelServerless from "@astrojs/vercel/serverless";
import tailwind from "@astrojs/tailwind";

// https://astro.build/config
export default defineConfig({
  integrations: [react(), tailwind({ applyBaseStyles: false })],
  output: "server",
  adapter: vercelServerless(),
});
