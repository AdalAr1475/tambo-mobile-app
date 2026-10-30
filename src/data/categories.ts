import type { Category, CategoryId } from './types';

export const categories: Category[] = [
  {
    id: 'bebidas',
    name: 'Bebidas',
    title: 'Bebidas y Licores',
    icon: 'bottle-soda-classic-outline',
    subcategories: ['Cervezas', 'RTD & Cocteles', 'Gaseosas', 'Licores', 'Energizantes', 'Aguas'],
    promo: '¡Arma tu previa con hasta 35% de descuento en packs!',
  },
  {
    id: 'snacks',
    name: 'Snacks',
    title: 'Snacks y Golosinas',
    icon: 'cookie-outline',
    subcategories: ['Papas y piqueos', 'Galletas', 'Chocolates', 'Caramelos'],
    promo: 'Lleva 2 snacks y el segundo sale a mitad de precio',
  },
  {
    id: 'comida',
    name: 'Comida lista',
    title: 'Comida lista',
    icon: 'food-croissant',
    subcategories: ['Empanadas', 'Sánguches', 'Hot dogs', 'Platos'],
    promo: 'Recién horneado en tu Tambo más cercano',
  },
  {
    id: 'cafeteria',
    name: 'Cafetería',
    title: 'Cafetería',
    icon: 'coffee-outline',
    subcategories: ['Café', 'Desayunos', 'Postres'],
  },
  {
    id: 'lacteos',
    name: 'Lácteos',
    title: 'Lácteos y Helados',
    icon: 'water-outline',
    subcategories: ['Leches', 'Yogures', 'Helados'],
    promo: '2x1 en helados D’Onofrio los fines de semana',
  },
  {
    id: 'abarrotes',
    name: 'Abarrotes',
    title: 'Abarrotes',
    icon: 'basket-outline',
    subcategories: ['Básicos', 'Hielo', 'Instantáneos'],
  },
  {
    id: 'limpieza',
    name: 'Limpieza',
    title: 'Limpieza del hogar',
    icon: 'spray-bottle',
    subcategories: ['Hogar', 'Lavado'],
  },
  {
    id: 'cuidado',
    name: 'Cuidado',
    title: 'Cuidado personal',
    icon: 'lotion-plus-outline',
    subcategories: ['Higiene', 'Farmacia'],
  },
];

export const getCategory = (id: string) => categories.find((c) => c.id === (id as CategoryId));
