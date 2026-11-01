import { categoriasDe } from './catalogo.ts'
import type { Categoria, Centavos, Movimiento, TipoMovimiento } from './tipos.ts'

/**
 * Texto rápido (PROPUESTA.md Etapa 9): "helado 2500", "5 lucas de súper" o lo
 * que se dicte con el micrófono del teclado. Saca el monto, deja el resto como
 * nota y sugiere la categoría: primero por lo que la familia ya cargó con esas
 * palabras, después por un diccionario.
 */

export interface TextoInterpretado {
  monto: Centavos | null
  nota: string
  categoria: Categoria | null
}

/** Minúsculas y sin tildes, para comparar palabras ("Súper" = "super"). */
export const normalizar = (texto: string) =>
  texto.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()

// "$ 2.500", "2500,50", "15 mil", "5 lucas", "2k"
// El número no puede estar pegado a una palabra ("mp3", "Max2").
const NUMERO =
  /(?<![\p{L}\d])\$?\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?\s*(k|mil|lucas?)?(?![\p{L}\d])/iu
// Palabras sueltas que sobran en la nota: "2500 de helado" → "helado".
const SOBRAN = new Set(['de', 'en', 'por', 'pesos', 'peso', 'el', 'la', 'un', 'una'])

/** Palabras clave por categoría (sin tildes). Lo que la familia ya cargó tiene prioridad. */
const CLAVES: Record<string, readonly string[]> = {
  super: [
    'super',
    'supermercado',
    'chino',
    'coto',
    'carrefour',
    'jumbo',
    'disco',
    'vea',
    'changomas',
    'almacen',
    'verduleria',
    'verdura',
    'carniceria',
    'carne',
    'fiambreria',
    'dietetica',
  ],
  comida: [
    'helado',
    'pizza',
    'empanadas',
    'cafe',
    'almuerzo',
    'cena',
    'delivery',
    'rappi',
    'pedidosya',
    'hamburguesa',
    'sushi',
    'cerveza',
    'birra',
    'restaurante',
    'resto',
    'bar',
    'merienda',
    'facturas',
    'panaderia',
    'kiosco',
    'golosinas',
  ],
  casa: [
    'ferreteria',
    'pintura',
    'mueble',
    'muebles',
    'limpieza',
    'plomero',
    'electricista',
    'arreglo',
    'alquiler',
    'expensas',
    'bazar',
  ],
  servicios: [
    'luz',
    'gas',
    'agua',
    'internet',
    'telefono',
    'celular',
    'cable',
    'edenor',
    'edesur',
    'metrogas',
    'aysa',
    'personal',
    'movistar',
    'claro',
    'fibertel',
    'telecentro',
    'abl',
  ],
  transporte: [
    'sube',
    'colectivo',
    'bondi',
    'tren',
    'subte',
    'nafta',
    'combustible',
    'ypf',
    'shell',
    'axion',
    'uber',
    'cabify',
    'didi',
    'taxi',
    'remis',
    'peaje',
    'estacionamiento',
    'cochera',
    'mecanico',
    'service',
    'patente',
    'seguro',
  ],
  salud: [
    'farmacia',
    'remedio',
    'remedios',
    'medicamento',
    'medico',
    'doctor',
    'dentista',
    'odontologo',
    'analisis',
    'prepaga',
    'osde',
    'swiss',
    'galeno',
    'kinesiologo',
    'psicologo',
  ],
  ropa: [
    'ropa',
    'zapatillas',
    'remera',
    'pantalon',
    'campera',
    'zapatos',
    'buzo',
    'jean',
    'medias',
  ],
  suscripciones: [
    'netflix',
    'spotify',
    'disney',
    'hbo',
    'max',
    'prime',
    'youtube',
    'icloud',
    'paramount',
    'chatgpt',
  ],
  ocio: [
    'cine',
    'teatro',
    'recital',
    'entradas',
    'entrada',
    'juego',
    'viaje',
    'hotel',
    'vacaciones',
    'museo',
    'pileta',
  ],
  regalos: ['regalo', 'regalos', 'cumple', 'cumpleanos'],
  cuidado: [
    'peluqueria',
    'barberia',
    'corte',
    'manicura',
    'depilacion',
    'perfume',
    'crema',
    'shampoo',
    'maquillaje',
  ],
  sueldo: ['sueldo', 'salario', 'quincena', 'haberes'],
  aguinaldo: ['aguinaldo', 'sac'],
  extras: ['extra', 'changa', 'bono', 'freelance', 'venta', 'vendi'],
  reintegros: ['reintegro', 'devolucion', 'cashback', 'reembolso'],
}

const palabras = (texto: string) => normalizar(texto).match(/[\p{L}\d]+/gu) ?? []

export function interpretarTexto(
  texto: string,
  contexto: {
    tipo: TipoMovimiento
    movimientos: Movimiento[]
    /** Las que se ofrecen para cargar (con las propias); si falta, las de fábrica. */
    categorias?: Categoria[]
  },
): TextoInterpretado {
  const encontrado = texto.match(NUMERO)
  let monto: Centavos | null = null
  let resto = texto
  if (encontrado) {
    const [todo, entero = '', decimales = '', multiplicador] = encontrado
    const pesos = Number(entero.replace(/\./g, '')) * (multiplicador ? 1000 : 1)
    const centavos = multiplicador ? 0 : Number(decimales.padEnd(2, '0') || '0')
    monto = pesos * 100 + centavos
    resto = texto.replace(todo, ' ')
  }
  const nota = resto
    .replace(/\$/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((p, i, todas) => {
      const extremo = i === 0 || i === todas.length - 1
      return !(extremo && SOBRAN.has(normalizar(p)))
    })
    .join(' ')
    .trim()

  return {
    monto: monto && monto > 0 ? monto : null,
    nota,
    categoria: sugerirCategoria(nota, contexto),
  }
}

function sugerirCategoria(
  nota: string,
  {
    tipo,
    movimientos,
    categorias,
  }: { tipo: TipoMovimiento; movimientos: Movimiento[]; categorias?: Categoria[] },
): Categoria | null {
  const posibles = categorias ?? categoriasDe(tipo)
  const claves = palabras(nota).filter((p) => p.length >= 3 && !/^\d+$/.test(p))
  if (claves.length === 0) return null

  // 1. Lo que ya cargó la familia con alguna de esas palabras en la nota.
  const votos = new Map<string, number>()
  for (const m of movimientos) {
    if (m.borrado || m.tipo !== tipo || !m.nota) continue
    const enLaNota = new Set(palabras(m.nota))
    if (claves.some((c) => enLaNota.has(c)))
      votos.set(m.categoria, (votos.get(m.categoria) ?? 0) + 1)
  }
  const masVotada = [...votos.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const porHistoria = posibles.find((c) => c.id === masVotada)
  if (porHistoria) return porHistoria

  // 2. El diccionario.
  return posibles.find((c) => claves.some((p) => CLAVES[c.id]?.includes(p))) ?? null
}
