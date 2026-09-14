import type { CapacitorConfig } from "@capacitor/cli";

// El WebView carga la app real desde Vercel (server.url), no un bundle estático —
// necesitamos SSR, Server Actions y Clerk, que "next export" no soporta.
// webDir igual es obligatorio para el CLI; apunta a public/ como placeholder sin uso.
const config: CapacitorConfig = {
  appId: "com.timecoin.app",
  appName: "TimeCoin",
  webDir: "public",
  server: {
    url: process.env.CAPACITOR_SERVER_URL ?? "http://10.0.2.2:3000",
    cleartext: process.env.CAPACITOR_SERVER_URL ? false : true,
  },
};

export default config;
