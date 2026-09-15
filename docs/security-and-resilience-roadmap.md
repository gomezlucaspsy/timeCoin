# Security & resilience roadmap — blockchain-node

Hoy `apps/blockchain-node` es un nodo único corriendo en Fly.io. Es un clon real de
Bitcoin en lo criptográfico (PoW, UTXO, firmas secp256k1 verificadas server-side en
`transaction.ts`), pero en infraestructura es un servidor centralizado sin backups,
sin rate limiting y sin segundo nodo. Este documento lista qué falta para acercarlo
al nivel de seguridad que la gente espera de MercadoPago (procesador centralizado
pero endurecido) o de Bitcoin (red descentralizada), ordenado por esfuerzo.

## P0 — rápido, esta semana

- [ ] **Escritura atómica del snapshot.** `persistence.ts` hace `writeFileSync` directo
  sobre `chain.json` en cada tx/bloque aceptado. Un crash a mitad de escritura corrompe
  la única copia de la cadena. Cambiar a escribir en un archivo temporal + `rename`.
- [ ] **Rate limiting en `/tx` y `/mine`.** Ningún endpoint en `server.ts` limita por IP.
  `/mine` corre el loop de PoW de forma síncrona (hasta 20M intentos) bloqueando el
  event loop — es un DoS trivial. Agregar un límite simple por IP (token bucket).
- [ ] **Tope al mempool.** No hay límite visible de tamaño en `chain.mempool`; alguien
  puede floodear transacciones sin fee. Cap por cantidad y por tamaño de tx.
- [ ] **Backup automático fuera de Fly.** Hoy no existe ningún backup del `chain.json`.
  Job periódico (cron en el propio proceso, o GitHub Action) que suba el snapshot a
  almacenamiento separado (Vercel Blob / S3-compatible), para que la data no dependa
  de que el volumen de Fly siga intacto.
- [ ] **Healthcheck + alerta.** Endpoint de salud ya existe (`/status`); falta algo
  externo mirándolo (UptimeRobot / Better Stack, tier gratis) que avise si el nodo cae.

## P1 — 1-2 semanas

- [ ] **CI/CD real.** No hay `.github/workflows`; el deploy a Fly es manual
  (`flyctl deploy` desde la laptop de quien lo tenga configurado). Bus factor de una
  sola persona y cero historial reproducible. Agregar un workflow que deployee a Fly
  al mergear a `main`, después de que CodeRabbit + tests pasen en el PR.
- [ ] **Log de auditoría append-only**, separado del `chain.json` mutable, de cada
  tx/bloque aceptado — para poder investigar un incidente sin depender del estado
  actual del archivo.
- [ ] **Nodo standby en otro proveedor** (Railway o Render, mismo `Dockerfile`) que
  corra en paralelo al de Fly. `apps/web` apunta a `TIMECOIN_NODE_URL` con fallback,
  así una caída de Fly no tumba la wallet. Esto es además el primer paso real hacia P2.

## P2 — descentralización real (lo que de verdad iguala a "seguro como Bitcoin")

- [ ] **Gossip P2P entre nodos.** El README ya marca esto como "deliberately out of
  scope" pero `Blockchain.replaceChainIfBetter` (regla de la cadena más larga válida)
  ya está implementada — falta la capa de red que la use. Sin esto, por más backups y
  standby que tenga, technically sigue siendo un solo operador con una sola verdad.
- [ ] **Mercado de fees.** Hoy las tx son gratis en devnet; sin costo, floodear el
  mempool es gratis incluso con el cap del P0. Un fee mínimo lo desincentiva.

## Sobre depender solo de Fly.io

No es un problema específico de Fly — pasaría igual con cualquier PaaS único
(Railway, Render, un VPS). El riesgo real es tener **una sola instancia corriendo en
un solo lugar** con **cero backup** de la data. La solución no es "irse de Fly", es:

1. Fly sigue siendo el nodo primario.
2. Se levanta un segundo nodo (mismo Docker image) en otro proveedor como standby —
   ítem P1 de arriba.
3. `apps/web` recibe una URL de fallback por env var.
4. El backup automático del snapshot (P0) se hace pase lo que pase, independientemente
   de cuántos nodos corran, porque es lo único que protege la data en sí.

Los ítems 2-3 son, en los hechos, el arranque del gossip P2P de P2 — construir el
nodo standby ya es tener el segundo nodo real de la red.
