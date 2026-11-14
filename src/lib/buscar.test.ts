import { describe, expect, it } from 'vitest'
import { buscarInsumos, normalizar } from './buscar'

const catalogo = [
  { codigo: '200035', nombre: 'AGUJA DESECH 18 GX 1 1/2' },
  { codigo: '200039', nombre: 'AGUJA DESECH 21 GX1 1/2' },
  { codigo: '200392', nombre: 'JERINGA 10ML AGUJA 21 GX11/2 PTA LUERL' },
  { codigo: '200071', nombre: 'APOSITO CHICO 10X20CM ESTERIL' },
  { codigo: '200468', nombre: 'PAÑAL DESECH P/ADULTO (TIPO SABANILLA)' },
  { codigo: '200154', nombre: 'CANULA MAYO N°3 / 9 CM' },
  { codigo: null, nombre: 'PECHERA MANGA CORTA' },
  { codigo: '250066', nombre: 'Alcohol 70% Dosificación' },
]
const nombres = (q: string) => buscarInsumos(catalogo, q).map((i) => i.nombre)

describe('normalizar', () => {
  it('quita tildes y mayúsculas', () => {
    expect(normalizar('  Apósito ESTÉRIL ')).toBe('aposito esteril')
    expect(normalizar('PAÑAL')).toBe('panal')
  })
})

describe('buscarInsumos', () => {
  it('"aguja" muestra todas las agujas, primero las que empiezan así', () => {
    expect(nombres('aguja')).toEqual(['AGUJA DESECH 18 GX 1 1/2', 'AGUJA DESECH 21 GX1 1/2', 'JERINGA 10ML AGUJA 21 GX11/2 PTA LUERL'])
  })
  it('no distingue tildes: lo escrito con tilde encuentra lo guardado sin tilde y viceversa', () => {
    expect(nombres('apósito')).toEqual(['APOSITO CHICO 10X20CM ESTERIL'])
    expect(nombres('estéril')).toEqual(['APOSITO CHICO 10X20CM ESTERIL'])
    expect(nombres('dosificacion')).toEqual(['Alcohol 70% Dosificación'])
    expect(nombres('panal')).toEqual(['PAÑAL DESECH P/ADULTO (TIPO SABANILLA)'])
    expect(nombres('pañal')).toEqual(['PAÑAL DESECH P/ADULTO (TIPO SABANILLA)'])
  })
  it('no distingue mayúsculas', () => {
    expect(nombres('AgUjA')).toHaveLength(3)
  })
  it('acepta palabras parciales, varias y en cualquier orden', () => {
    expect(nombres('agu')).toHaveLength(3)
    expect(nombres('21 aguj')).toEqual(['AGUJA DESECH 21 GX1 1/2', 'JERINGA 10ML AGUJA 21 GX11/2 PTA LUERL'])
    expect(nombres('jer 10')).toEqual(['JERINGA 10ML AGUJA 21 GX11/2 PTA LUERL'])
    expect(nombres('teril')).toEqual(['APOSITO CHICO 10X20CM ESTERIL'])
  })
  it('busca por código completo o parcial, y el código va primero', () => {
    expect(nombres('200039')).toEqual(['AGUJA DESECH 21 GX1 1/2'])
    expect(nombres('2000')).toEqual(['AGUJA DESECH 18 GX 1 1/2', 'AGUJA DESECH 21 GX1 1/2', 'APOSITO CHICO 10X20CM ESTERIL'])
    expect(nombres('0392')).toEqual(['JERINGA 10ML AGUJA 21 GX11/2 PTA LUERL'])
  })
  it('encuentra insumos sin código', () => {
    expect(nombres('pechera')).toEqual(['PECHERA MANGA CORTA'])
  })
  it('sin coincidencias devuelve vacío; sin texto devuelve todo por nombre', () => {
    expect(nombres('zzz')).toEqual([])
    expect(nombres('aguja zzz')).toEqual([])
    expect(nombres('   ')).toHaveLength(catalogo.length)
    expect(nombres('')[0]).toBe('AGUJA DESECH 18 GX 1 1/2')
  })
  it('respeta el límite', () => {
    expect(buscarInsumos(catalogo, 'a', 2)).toHaveLength(2)
  })
})
