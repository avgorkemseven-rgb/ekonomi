import type { AttributeType } from '@kleps/shared';

export interface SeedAttribute {
  key: string;
  label: string;
  type: AttributeType;
  options?: string[];
  unit?: string;
  required?: boolean;
  filterable?: boolean;
}

export interface SeedCategory {
  slug: string;
  name: string;
  en: string;
  icon?: string;
  attributes?: SeedAttribute[];
  children?: SeedCategory[];
}

export const CATEGORY_TREE: SeedCategory[] = [
  {
    slug: 'bilardo',
    name: 'Bilardo',
    en: 'Billiards',
    icon: 'billiards',
    attributes: [
      {
        key: 'gameType',
        label: 'Oyun türü',
        type: 'SELECT',
        options: ['Amerikan (Pool)', 'Snooker', '3 Bant / Karambol', 'Genel'],
        filterable: true,
      },
    ],
    children: [
      {
        slug: 'bilardo-istakalari',
        name: 'Istakalar',
        en: 'Cues',
        icon: 'cue',
        attributes: [
          {
            key: 'cueType',
            label: 'Istaka tipi',
            type: 'SELECT',
            options: ['Oyun istakası', 'Kırma istakası', 'Zıplatma istakası', 'Kırma-zıplatma'],
            required: true,
            filterable: true,
          },
          { key: 'tipSize', label: 'Uç çapı', type: 'NUMBER', unit: 'mm', filterable: true },
          { key: 'weight', label: 'Ağırlık', type: 'NUMBER', unit: 'gr', filterable: true },
          { key: 'length', label: 'Uzunluk', type: 'NUMBER', unit: 'cm' },
          {
            key: 'pieces',
            label: 'Parça sayısı',
            type: 'SELECT',
            options: ['Tek parça', 'İki parça', 'Üç parça'],
            filterable: true,
          },
          {
            key: 'shaftType',
            label: 'Şaft tipi',
            type: 'SELECT',
            options: ['Klasik ahşap', 'Düşük sapmalı (LD) ahşap', 'Karbon'],
            filterable: true,
          },
          {
            key: 'jointType',
            label: 'Bağlantı (joint)',
            type: 'SELECT',
            options: ['Radial', 'Uni-Loc', '3/8x10', '5/16x14', 'Quick Release', 'Diğer'],
          },
          { key: 'includesCase', label: 'Kılıf dahil', type: 'BOOLEAN' },
        ],
      },
      {
        slug: 'bilardo-masalari',
        name: 'Bilardo Masaları',
        en: 'Billiard Tables',
        icon: 'table',
        attributes: [
          {
            key: 'tableSize',
            label: 'Masa ölçüsü',
            type: 'SELECT',
            options: ['6 ft', '7 ft', '8 ft', '9 ft', '10 ft', '12 ft'],
            required: true,
            filterable: true,
          },
          { key: 'slate', label: 'Arduvaz (taş) tabla', type: 'BOOLEAN', filterable: true },
          { key: 'heated', label: 'Isıtmalı', type: 'BOOLEAN' },
        ],
      },
      {
        slug: 'bilardo-toplari',
        name: 'Bilardo Topları',
        en: 'Billiard Balls',
        icon: 'balls',
        attributes: [
          {
            key: 'setType',
            label: 'Set tipi',
            type: 'SELECT',
            options: ['Tam set', 'Tek top', 'Antrenman topu'],
            filterable: true,
          },
          {
            key: 'ballDiameter',
            label: 'Top çapı',
            type: 'SELECT',
            options: ['57,2 mm', '61,5 mm', '52,4 mm'],
            filterable: true,
          },
        ],
      },
      {
        slug: 'bilardo-aksesuarlari',
        name: 'Bilardo Aksesuarları',
        en: 'Billiards Accessories',
        icon: 'accessory',
        attributes: [
          {
            key: 'accessoryType',
            label: 'Aksesuar tipi',
            type: 'SELECT',
            options: ['Istaka çantası / kılıfı', 'Istaka ucu (tip)', 'Tebeşir', 'Eldiven', 'Köprü / uzatma', 'Bakım ürünü', 'Diğer'],
            required: true,
            filterable: true,
          },
        ],
      },
    ],
  },
  {
    slug: 'dart',
    name: 'Dart',
    en: 'Darts',
    icon: 'darts',
    children: [
      {
        slug: 'dart-oklari',
        name: 'Dart Okları',
        en: 'Darts',
        icon: 'dart',
        attributes: [
          {
            key: 'tipType',
            label: 'Uç tipi',
            type: 'SELECT',
            options: ['Çelik uç (steel)', 'Plastik uç (soft)'],
            required: true,
            filterable: true,
          },
          { key: 'weight', label: 'Ağırlık', type: 'NUMBER', unit: 'gr', required: true, filterable: true },
          {
            key: 'material',
            label: 'Gövde malzemesi',
            type: 'SELECT',
            options: ['%97 Tungsten', '%95 Tungsten', '%90 Tungsten', '%85 Tungsten', '%80 Tungsten', 'Nikel-gümüş', 'Pirinç'],
            filterable: true,
          },
          { key: 'setCount', label: 'Set adedi', type: 'NUMBER', unit: 'adet' },
        ],
      },
      {
        slug: 'dart-tahtalari',
        name: 'Dart Tahtaları',
        en: 'Dartboards',
        icon: 'dartboard',
        attributes: [
          {
            key: 'boardType',
            label: 'Tahta tipi',
            type: 'SELECT',
            options: ['Kıl (sisal)', 'Elektronik', 'Mıknatıslı', 'Diğer'],
            required: true,
            filterable: true,
          },
          { key: 'hasCabinet', label: 'Dolaplı', type: 'BOOLEAN', filterable: true },
          { key: 'hasLighting', label: 'Aydınlatmalı', type: 'BOOLEAN' },
        ],
      },
      {
        slug: 'dart-aksesuarlari',
        name: 'Dart Aksesuarları',
        en: 'Darts Accessories',
        icon: 'accessory',
        attributes: [
          {
            key: 'accessoryType',
            label: 'Aksesuar tipi',
            type: 'SELECT',
            options: ['Flight (kanat)', 'Shaft (gövde)', 'Uç', 'Çanta / kutu', 'Aydınlatma', 'Atış çizgisi / mat', 'Diğer'],
            required: true,
            filterable: true,
          },
        ],
      },
    ],
  },
];

/** brand name → leaf category slugs it is offered in; models are optional (name, category slug). */
export const BRANDS: { name: string; categories: string[]; models?: [string, string][] }[] = [
  {
    name: 'Predator',
    categories: ['bilardo-istakalari', 'bilardo-aksesuarlari'],
    models: [
      ['REVO 12.4', 'bilardo-istakalari'],
      ['REVO 12.9', 'bilardo-istakalari'],
      ['P3', 'bilardo-istakalari'],
      ['BK Rush', 'bilardo-istakalari'],
      ['Air Rush', 'bilardo-istakalari'],
    ],
  },
  {
    name: 'Mezz',
    categories: ['bilardo-istakalari', 'bilardo-aksesuarlari'],
    models: [
      ['EC7', 'bilardo-istakalari'],
      ['Power Break Kai', 'bilardo-istakalari'],
    ],
  },
  { name: 'Cuetec', categories: ['bilardo-istakalari'], models: [['Cynergy', 'bilardo-istakalari']] },
  { name: 'Peri', categories: ['bilardo-istakalari'] },
  { name: 'Fury', categories: ['bilardo-istakalari'] },
  { name: 'McDermott', categories: ['bilardo-istakalari'] },
  { name: 'Lucasi', categories: ['bilardo-istakalari'] },
  { name: 'Longoni', categories: ['bilardo-istakalari', 'bilardo-aksesuarlari'] },
  { name: 'Molinari', categories: ['bilardo-istakalari', 'bilardo-aksesuarlari'] },
  { name: 'Players', categories: ['bilardo-istakalari'] },
  { name: 'Brunswick', categories: ['bilardo-masalari'], models: [['Gold Crown VI', 'bilardo-masalari']] },
  { name: 'Diamond', categories: ['bilardo-masalari'], models: [['Professional', 'bilardo-masalari']] },
  { name: 'Wiraka', categories: ['bilardo-masalari'] },
  { name: 'Rasson', categories: ['bilardo-masalari'] },
  {
    name: 'Aramith',
    categories: ['bilardo-toplari'],
    models: [
      ['Tournament', 'bilardo-toplari'],
      ['Super Pro', 'bilardo-toplari'],
    ],
  },
  { name: 'Cyclop', categories: ['bilardo-toplari'] },
  { name: 'Kamui', categories: ['bilardo-aksesuarlari'] },
  { name: 'Taom', categories: ['bilardo-aksesuarlari'] },
  {
    name: 'Target',
    categories: ['dart-oklari', 'dart-tahtalari', 'dart-aksesuarlari'],
    models: [['Power 9Five', 'dart-oklari']],
  },
  {
    name: 'Winmau',
    categories: ['dart-oklari', 'dart-tahtalari', 'dart-aksesuarlari'],
    models: [['Blade 6', 'dart-tahtalari']],
  },
  { name: 'Harrows', categories: ['dart-oklari', 'dart-tahtalari', 'dart-aksesuarlari'], models: [['Supergrip', 'dart-oklari']] },
  { name: 'Unicorn', categories: ['dart-oklari', 'dart-tahtalari', 'dart-aksesuarlari'], models: [['Eclipse Pro', 'dart-tahtalari']] },
  { name: 'Red Dragon', categories: ['dart-oklari', 'dart-aksesuarlari'] },
  { name: 'Mission', categories: ['dart-oklari', 'dart-aksesuarlari'] },
  { name: "Bull's", categories: ['dart-oklari', 'dart-tahtalari', 'dart-aksesuarlari'] },
  { name: 'Cosmo Darts', categories: ['dart-oklari', 'dart-aksesuarlari'] },
  { name: 'L-Style', categories: ['dart-aksesuarlari'] },
  { name: 'Shot', categories: ['dart-oklari', 'dart-aksesuarlari'] },
  { name: 'Granboard', categories: ['dart-tahtalari'], models: [['Granboard 3s', 'dart-tahtalari']] },
];
