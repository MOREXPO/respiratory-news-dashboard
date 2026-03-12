export const COMPANIES = [
  'Breas Medical',
  'Philips Respironics',
  'ResMed',
  'Oxymesa',
  'Esteve Teijin',
  'Air Liquide',
  'Yuwell Medical',
  'BMC Medical',
] as const;

export type Company = (typeof COMPANIES)[number];
