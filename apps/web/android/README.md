# TimeCoin — shell nativo Android (Capacitor)

Este directorio lo generó `npx cap add android` (ver `../capacitor.config.ts`). El WebView
no empaqueta la app como bundle estático: carga la app real por HTTP desde `server.url`
(por defecto `http://10.0.2.2:3000`, el alias que usa el emulador de Android para llegar a
`localhost:3000` de tu máquina). Así la wallet sigue teniendo SSR, Server Actions, Clerk y
Neon sin tocar nada — el shell nativo solo agrega la cáscara + los plugins nativos
(por ahora, biometría vía `capacitor-native-biometric`, ver `../lib/timecoin/secureStorage.ts`
y `unlockNativeWallet()` en `../lib/timecoin/wallet.ts`).

## Requisitos (no incluidos en este entorno)
- JDK 17+
- Android SDK (via Android Studio, o solo `cmdline-tools` + `sdkmanager`)
- Un emulador o dispositivo físico con depuración USB

## Flujo de desarrollo
```bash
# 1. Levantar la app web (desde apps/web)
npm run dev

# 2. Sincronizar config/plugins nativos (repetir cada vez que cambie
#    capacitor.config.ts o se agregue un plugin)
npx cap sync android

# 3a. Abrir en Android Studio (recomendado para el primer build / firma)
npx cap open android

# 3b. o compilar un APK debug directo por línea de comandos
cd android && ./gradlew assembleDebug
# el APK queda en android/app/build/outputs/apk/debug/app-debug.apk
```

## Apuntar a un deploy real (staging/producción) en vez de localhost
```bash
CAPACITOR_SERVER_URL=https://<tu-deploy>.vercel.app npx cap sync android
```
Con `CAPACITOR_SERVER_URL` seteada, `capacitor.config.ts` fuerza `cleartext: false`
(solo HTTPS) — no la dejes vacía apuntando a un dominio HTTP en producción.

## Pendiente para que la wallet realmente use biometría
Hoy `secureStorage.ts` ya espeja el secreto (seed phrase o clave hex) al Keychain/Keystore
en cada `persist()`, y `unlockNativeWallet()` puede traerlo de vuelta pidiendo Face ID /
huella — pero `app/wallet/page.tsx` todavía carga la wallet siempre desde `localStorage`
(vía `loadOrCreateWallet()`), sin pantalla de "desbloqueo". El próximo paso es que, cuando
`Capacitor.isNativePlatform()` sea `true`, la página use `unlockNativeWallet()` primero y
solo caiga a `loadOrCreateWallet()` si no hay nada guardado todavía (primer uso).
