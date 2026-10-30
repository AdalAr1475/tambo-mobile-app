import type { PromoTag } from './types';

export type HeroBanner = {
  id: string;
  kicker: string;
  title: string;
  subtitle: string;
  validity: string;
  productId: string;
  colors: [string, string];
};

export const heroBanners: HeroBanner[] = [
  {
    id: 'nights',
    kicker: '¡Tamboo Nights!',
    title: '2x Four Loko Sandía',
    subtitle: 'RTD Lata 473 ml c/u',
    validity: 'Válido hoy hasta las 23:59',
    productId: 'fourloko-sandia-pack',
    colors: ['#6B1464', '#3D0638'],
  },
  {
    id: 'finde',
    kicker: 'Fin de semana',
    title: 'Pack Trío Previa',
    subtitle: 'Ron + Coca-Cola + Hielo 2 kg',
    validity: 'Válido sáb. y dom.',
    productId: 'combo-ron-hielo',
    colors: ['#7C0032', '#4C0047'],
  },
  {
    id: 'desayuno',
    kicker: 'Desayuno al paso',
    title: 'Combo Sanguchero',
    subtitle: 'Pan con chicharrón + café',
    validity: 'De 7 am a 12 pm',
    productId: 'pan-chicharron',
    colors: ['#8A5A00', '#5A0C50'],
  },
];

export type PromoCard = {
  id: string;
  tag: Exclude<PromoTag, 'descuentos'> | 'descuentos';
  kicker: string;
  validity: string;
  title: string;
  description: string;
  chip: string;
  productId: string;
  image: number;
  colors: [string, string];
  alcoholic?: boolean;
};

export const promoCards: PromoCard[] = [
  {
    id: 'estrella',
    tag: 'descuentos',
    kicker: 'Oferta estrella',
    validity: 'Válido hasta el 31/10',
    title: 'TAMBOO',
    description: 'Celebra con todo lo que necesitas',
    chip: 'Retiro gratis o Delivery',
    productId: 'fourloko-gold-pack',
    image: require('../../assets/images/promo-fourloko-sandia.jpg'),
    colors: ['#5A0C50', '#8E1E80'],
    alcoholic: true,
  },
  {
    id: 'sanguchero',
    tag: 'combos',
    kicker: 'Desayuno al paso',
    validity: 'Válido de 7am a 12pm',
    title: 'Combo Sanguchero',
    description: 'Crujiente pan con chicharrón criollo + café americano caliente recién pasado.',
    chip: 'Para empezar el día',
    productId: 'pan-chicharron',
    image: require('../../assets/images/pan-chicharron.jpg'),
    colors: ['#9A6B12', '#5A0C50'],
  },
  {
    id: 'helados',
    tag: '2x1',
    kicker: '2x1 especial',
    validity: 'Válido fines de semana',
    title: "2x1 en Helados D'Onofrio",
    description: 'Sin Parar chocomani, lúcuma o vainilla. ¡Llévate el segundo gratis!',
    chip: 'Antojo helado',
    productId: 'donofrio-sinparar',
    image: require('../../assets/images/donofrio-sinparar.jpg'),
    colors: ['#7C0032', '#4C0047'],
  },
  {
    id: 'previa',
    tag: 'combos',
    kicker: 'Top #1 previa',
    validity: 'Válido todo el mes',
    title: 'Combo Previa',
    description: 'Ron Cartavio + Coca-Cola 1.5 L + bolsa de hielo 2 kg.',
    chip: 'Listo en 25 min',
    productId: 'combo-ron-hielo',
    image: require('../../assets/images/combo-ron-coca-hielo.jpg'),
    colors: ['#4C0047', '#6B1464'],
    alcoholic: true,
  },
  {
    id: 'monster',
    tag: '2x1',
    kicker: 'Pack energía',
    validity: 'Hasta agotar stock',
    title: '2 Monster x S/ 13.90',
    description: 'Llévate dos latas de Monster Energy 473 ml a precio especial.',
    chip: 'Para la maratón',
    productId: 'monster',
    image: require('../../assets/images/monster.jpg'),
    colors: ['#1F3A12', '#4C0047'],
  },
];
