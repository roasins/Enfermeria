// Genera los íconos PNG de la app a partir de public/icono.svg (se corre a mano si cambia el ícono).
const { chromium } = require('playwright')
const fs = require('node:fs')
const path = require('node:path')
const pub = path.join(__dirname, '..', 'public')
const svg = fs.readFileSync(path.join(pub, 'icono.svg'), 'utf8')
;(async () => {
  const b = await chromium.launch()
  const hacer = async (nombre, lado, relleno) => {
    const p = await b.newPage({ viewport: { width: lado, height: lado } })
    const cuerpo = relleno
      ? `<body style="margin:0;background:#0f766e;display:grid;place-items:center;height:100vh"><div style="width:78%;height:78%">${svg}</div></body>`
      : `<body style="margin:0;background:transparent">${svg}</body>`
    await p.setContent(cuerpo)
    await p.screenshot({ path: path.join(pub, nombre), omitBackground: true })
    await p.close()
  }
  await hacer('icono-192.png', 192, false)
  await hacer('icono-512.png', 512, false)
  await hacer('icono-maskable-512.png', 512, true)
  await hacer('apple-touch-icon.png', 180, true)
  await b.close()
})()
