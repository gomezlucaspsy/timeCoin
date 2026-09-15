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
- [ ] **Aislar la minería del event loop.** El rate limiting solo reduce la frecuencia
  de requests, no limita la duración de uno ya aceptado: `chain.mineNextBlock(...)`
  corre síncrono y puede tardar hasta 20M iteraciones bloqueando todo lo demás. Mover
  la minería a un worker thread o proceso separado, con timeout y cancelación —
  el rate limiting queda como control adicional, no como solución del DoS.
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
  al mergear a `main`, después de que pasen los checks de este documento (ver
  "Cómo usar este documento" más abajo) y los tests.
- [ ] **Log de auditoría append-only**, separado del `chain.json` mutable, de cada
  tx/bloque aceptado — para poder investigar un incidente sin depender del estado
  actual del archivo.
- [ ] **Nodo standby en otro proveedor** (Railway o Render, mismo `Dockerfile`) que
  corra en paralelo al de Fly, **pero no como failover automático hasta tener**:
  replicación verificada del snapshot, reconciliación de cadena vía
  `Blockchain.replaceChainIfBetter`, y fencing de un solo escritor. Sin esto, si
  `apps/web` cae a `TIMECOIN_NODE_URL` de fallback con un snapshot desactualizado,
  cada nodo puede aceptar un bloque distinto a la misma altura (ambos validan
  `previousHash` contra su propia punta) y se pierden transacciones aceptadas en el
  nodo que quedó fuera de servicio. Hasta tener esos tres mecanismos, tratar el
  standby como respaldo frío (para recuperación manual), no como fallback en caliente.
  Es igual el primer paso real hacia P2.

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

## Criptografía y anonimidad — criterios de diseño

Prioridad del proyecto: **anonimidad y seguridad por sobre conveniencia**. Para
decidir qué primitivas criptográficas usar, el criterio no es "lo publicó la
NSA/NIST" per se (esa misma fuente introdujo el backdoor de Dual_EC_DRBG en su
momento) sino: **algoritmos públicos, estandarizados y con décadas de
criptoanálisis abierto sin romper**, que es justamente el subconjunto que NIST
FIPS y el CNSA 2.0 suite terminan recomendando porque sobrevivieron ese
escrutinio — no al revés.

- **Lo que ya usamos y es correcto mantener:** SHA-256 (FIPS 180-4) y firmas
  ECDSA sobre secp256k1 (mismo esquema que Bitcoin) — ambos ampliamente
  auditados. No reemplazar por curvas o hashes "custom" ni por versiones no
  estándar.
- [ ] **Nunca implementar primitivas criptográficas propias.** Cualquier
  necesidad nueva (ej. cifrado de un backup, un canal privado) debe resolverse
  con librerías/algoritmos FIPS-validados o CNSA 2.0 (AES-256-GCM, SHA-256/
  SHA-3, ECDSA/EdDSA sobre curvas estándar), nunca con un esquema inventado.
- [ ] **La clave privada nunca toca el servidor** (ya cubierto en P0 de
  `apps/blockchain-node`, pero aplica igual a `apps/web`): firmar siempre
  client-side, el server solo verifica.
- [ ] **Evitar reuso de direcciones.** Reusar la misma address rompe la
  pseudonimidad de UTXO (permite correlacionar historial). La wallet debería
  poder derivar direcciones nuevas por recepción (ya hay BIP-39 seed phrase,
  falta el path de derivación por dirección).
- [ ] **No loguear ni retener IPs de clientes** más allá de la ventana que
  necesita el rate limiting (P0). Sin logs de acceso persistentes en `/tx` y
  `/mine` que permitan correlacionar IP ↔ dirección con el tiempo.
- [ ] **Evaluar exponer el nodo también como servicio onion (Tor)**, opcional
  y en paralelo al endpoint HTTPS normal, para que quien lo use pueda evitar
  exponer su IP al nodo.
- [ ] **Minimizar telemetría en `apps/web`.** Nada de analytics de terceros
  que asocie IP/dispositivo con una wallet address o transacción específica.

## Cómo usar este documento (reemplaza la revisión automática de CodeRabbit)

CodeRabbit se probó en el PR #5 y se dio de baja: el review automático por PR
se volvía lento y generaba un ida-y-vuelta grande de comentarios/IA por cada
cambio chico, más de lo que aporta en un repo de este tamaño. Este documento es
ahora la referencia manual de seguridad:

- Antes de mergear un PR que toque `apps/blockchain-node/**`, repasar la
  sección P0 relevante al cambio (firmas/montos, dificultad/reorgs, rate
  limiting, manejo de la clave privada).
- Antes de mergear un PR que toque `apps/web/**` y auth, verificar: rutas
  protegidas usan `<Show when="signed-in">` (no `<SignedIn>/<SignedOut>/
  <Protect>`, deprecados en Clerk Core 3), y ningún middleware usa
  `auth.protect()` a secas donde se espera redirect en vez de 404 (ver
  `redirectToSignIn()` en el código de `proxy.ts`).
- Marcar los ítems como hechos (`- [x]`) a medida que se resuelven, en el
  mismo PR que los resuelve.
