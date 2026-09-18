# Caja Real

Módulo de planificación financiera sobre el score X-Ray. HackSpain 2026, reto de Embat.

**Demo:** _(URL pública pendiente de despliegue)_

## Ejecutar en local

```
npm ci
npm run dev        # http://localhost:5173
npm run build && npm run preview   # build estático en http://localhost:4173
```

Abre `#/g/GROUP_0016`. Sin login: la autorización es una lista blanca simulada.

## Datos

La app solo lee de `src/data.ts`. Por defecto carga `src/fixtures/*.json` (generados por
`../fixture_gen.py` desde el dump de Embat con un scorecard determinista, versión
`fixture-v1-scorecard`). Cuando el modelo entregue, se añaden ficheros `*.model.json` con la
misma forma y se construye con `VITE_DATA_SRC=model`; cada empresa que falte cae al fixture.

Contrato Model → App: `src/types.ts`. Comprobación de forma: `node scripts/check-fixtures.mjs`.

## Pantallas

`#/g/:gid` grupo · `#/g/:gid/c/:id` empresa · `.../caja` camino de caja · `.../plan/:goalId`
objetivo y planes · `#/g/:gid/alertas` alertas y anticipación medida.
