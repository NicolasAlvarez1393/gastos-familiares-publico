/**
 * El panel 🐞 del modo debug. Se inyecta en la página desde `debug.mjs` (nunca forma parte de la
 * app publicada) y habla con el script por `window.__debug(accion)`, que devuelve el estado.
 *
 * Playwright copia esta función tal cual a la página: no puede usar nada de afuera.
 * Los colores son fijos a propósito: tiene que verse distinto de la app, en claro y en oscuro.
 */
export function panelDeDebug() {
  if (window.top !== window) return

  const SECCIONES = [
    [
      'Tamaño',
      [
        ['Teléfono', 'tamanio:telefono'],
        ['Tablet', 'tamanio:tablet'],
        ['Compu', 'tamanio:compu'],
        ['Ventana', 'tamanio:ventana'],
      ],
    ],
    [
      'Tema',
      [
        ['Claro', 'tema:light'],
        ['Oscuro', 'tema:dark'],
        ['Sistema', 'tema:sistema'],
      ],
    ],
    [
      'Simular',
      [
        ['Sin señal', 'senal'],
        ['Sesión vencida', 'vencer'],
        ['Sin acceso', 'acceso'],
        ['Google con errores', 'errores'],
        ['Otro teléfono carga un gasto', 'otro'],
      ],
    ],
    [
      'Empezar de nuevo',
      [
        ['Nico, con datos', 'reiniciar:nico'],
        ['Nico, sin planilla', 'reiniciar:vacia'],
        ['Mica, invitada', 'reiniciar:mica'],
      ],
    ],
  ]

  // Qué botón queda marcado según el estado que devuelve el script.
  const marcado = (accion, e) =>
    ({
      [`tamanio:${e.tamanio}`]: true,
      [`tema:${e.tema}`]: true,
      senal: e.sinSenal,
      vencer: e.sesion === 'vencida',
      acceso: e.sinAcceso,
      errores: e.conErrores,
    })[accion] === true

  const CSS = `
    :host { all: initial; }
    * { box-sizing: border-box; font: 13px/1.35 system-ui, sans-serif; }
    .abrir { position: fixed; left: 0; top: 38%; z-index: 2147483647; width: 30px; height: 46px;
      padding: 0; border: 1px solid #0d9488; border-left: 0; border-radius: 0 12px 12px 0;
      background: #111827e6; color: #fff; font-size: 17px; cursor: pointer; }
    .panel { position: fixed; left: 6px; top: 50%; transform: translateY(-50%); z-index: 2147483647;
      width: 252px; max-height: 94vh; overflow: auto; padding: 10px 10px 12px; border-radius: 14px;
      border: 1px solid #0d9488; background: #111827f5; color: #f9fafb; box-shadow: 0 8px 28px #0007; }
    .titulo { display: flex; justify-content: space-between; align-items: center; font-weight: 600; }
    .cerrar { width: 32px; height: 32px; border: 0; background: none; color: #cbd5e1; font-size: 20px;
      cursor: pointer; }
    .estado { margin: 2px 0 6px; color: #cbd5e1; font-size: 12px; }
    h3 { margin: 10px 0 4px; color: #94a3b8; font-size: 11px; font-weight: 600;
      letter-spacing: 0.04em; text-transform: uppercase; }
    .fila { display: flex; flex-wrap: wrap; gap: 4px; }
    .op { flex: 1 1 auto; min-height: 32px; padding: 4px 8px; border: 1px solid #334155;
      border-radius: 8px; background: #1f2937; color: #f9fafb; cursor: pointer; }
    .op:hover { background: #334155; }
    .op[aria-pressed='true'] { border-color: #2dd4bf; background: #0f766e; }
    .abrir[data-falla='si'] { border-color: #f59e0b; background: #92400ef0; }
    [hidden] { display: none !important; }
  `

  function crear(etiqueta, propiedades = {}, hijos = []) {
    const el = document.createElement(etiqueta)
    Object.assign(el, propiedades)
    el.append(...hijos)
    return el
  }

  function montar() {
    if (document.getElementById('panel-debug')) return
    const host = crear('div', { id: 'panel-debug' })
    const raiz = host.attachShadow({ mode: 'open' })
    const hoja = new CSSStyleSheet()
    hoja.replaceSync(CSS)
    raiz.adoptedStyleSheets = [hoja]

    const abrir = crear('button', { className: 'abrir', textContent: '🐞', title: 'Modo debug' })
    abrir.setAttribute('aria-label', 'Abrir el panel de debug')
    const estado = crear('p', { className: 'estado' })
    const cerrar = crear('button', { className: 'cerrar', textContent: '×' })
    cerrar.setAttribute('aria-label', 'Cerrar el panel de debug')
    const botones = []
    const secciones = SECCIONES.map(([titulo, opciones]) =>
      crear('section', {}, [
        crear('h3', { textContent: titulo }),
        crear(
          'div',
          { className: 'fila' },
          opciones.map(([texto, accion]) => {
            const b = crear('button', { className: 'op', textContent: texto })
            b.addEventListener('click', () => hacer(accion))
            botones.push([b, accion])
            return b
          }),
        ),
      ]),
    )
    const panel = crear('div', { className: 'panel' }, [
      crear('div', { className: 'titulo' }, [
        crear('span', { textContent: '🐞 Debug · todo simulado' }),
        cerrar,
      ]),
      estado,
      ...secciones,
    ])

    function mostrar(e) {
      if (!e) return
      const senal = e.sinSenal ? 'sin señal' : 'con señal'
      estado.textContent = `${e.persona} · ${senal} · sesión ${e.sesion} · ${e.lecturas} lecturas a Sheets`
      for (const [b, accion] of botones) b.setAttribute('aria-pressed', String(marcado(accion, e)))
      // La pestañita se pone naranja mientras se simula una falla, para no olvidarse.
      const fallas = [
        e.sinSenal && 'sin señal',
        e.sesion === 'vencida' && 'sesión vencida',
        e.sinAcceso && 'sin acceso',
        e.conErrores && 'Google con errores',
      ].filter(Boolean)
      abrir.dataset.falla = fallas.length ? 'si' : 'no'
      abrir.title = fallas.length ? `Modo debug: ${fallas.join(', ')}` : 'Modo debug'
    }
    async function hacer(accion) {
      try {
        mostrar(await window.__debug(accion))
      } catch {
        // La página se está recargando (por ejemplo, al empezar de nuevo).
      }
      // Funciona como un menú: en el teléfono el panel tapa la app, así que se cierra solo.
      if (accion !== 'estado') abrirPanel(false)
    }
    function abrirPanel(abierto) {
      panel.hidden = !abierto
      abrir.hidden = abierto
      if (abierto) void hacer('estado')
    }
    abrir.addEventListener('click', () => abrirPanel(true))
    cerrar.addEventListener('click', () => abrirPanel(false))
    setInterval(() => !panel.hidden && void hacer('estado'), 1500)

    raiz.append(abrir, panel)
    document.documentElement.append(host)
    abrirPanel(false)
    void hacer('estado')
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar)
  else montar()
}
