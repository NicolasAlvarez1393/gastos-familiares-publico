// El tema que se ve (Ajustes → Tema), decidido ANTES de dibujar la pantalla: así no aparece un
// instante el otro. Va en un archivo aparte porque la CSP no permite scripts en línea.
// Pone `data-tema` en <html> ("claro" u "oscuro", lo que mira src/index.css) y el color de la
// barra de estado. Con "Como el teléfono" sigue al teléfono, también si cambia con la app
// abierta. La app lo vuelve a aplicar al elegir otro tema (src/app/tema.ts).
;(function () {
  var CLAVE = 'gastos-familiares:tema'
  // El --gf-fondo de cada tema en src/index.css.
  var COLOR_DE_BARRA = { claro: '#f6f7f9', oscuro: '#0e1116' }
  var oscuroDelTelefono = window.matchMedia
    ? window.matchMedia('(prefers-color-scheme: dark)')
    : null

  function aplicar() {
    var elegido = null
    try {
      elegido = localStorage.getItem(CLAVE)
    } catch {
      // Sin acceso al almacenamiento (modo privado): queda el del teléfono.
    }
    var tema =
      elegido === 'claro' || elegido === 'oscuro'
        ? elegido
        : oscuroDelTelefono && oscuroDelTelefono.matches
          ? 'oscuro'
          : 'claro'
    document.documentElement.dataset.tema = tema
    var metas = document.querySelectorAll('meta[name="theme-color"]')
    for (var i = 0; i < metas.length; i++) metas[i].setAttribute('content', COLOR_DE_BARRA[tema])
  }

  aplicar()
  if (oscuroDelTelefono) {
    // Safari de iOS 13 solo tiene addListener.
    if (oscuroDelTelefono.addEventListener) oscuroDelTelefono.addEventListener('change', aplicar)
    else oscuroDelTelefono.addListener(aplicar)
  }
  window.gastosFamiliaresTema = { aplicar: aplicar }
})()
