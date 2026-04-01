import type { Ingredient, GroceryCategory, LocationId, Unit, Nutrients } from '../types';

// Nutrition values are generic per-100 g estimates modelled on USDA FoodData
// Central "generic" entries. Prices are rough US estimates (late 2020s) and are
// always flagged as `estimate` until you enter or verify a real price.

const TODAY = '2026-11-12';

function n(kcal: number, protein: number, carbs: number, fat: number, fiber: number): Nutrients {
  return { kcal, protein, carbs, fat, fiber };
}

interface Opts {
  unitWeights?: Partial<Record<Unit, number>>;
  density?: number;
  pkg?: [number, Unit, number]; // qty, unit, price
  staple?: boolean;
  nonFood?: boolean;
  substitutes?: string[];
  cheaper?: string[];
  store?: string;
}

function ing(
  id: string,
  name: string,
  category: GroceryCategory,
  defaultLocation: LocationId,
  defaultUnit: Unit,
  per100g: Nutrients | undefined,
  o: Opts = {},
): Ingredient {
  return {
    id,
    name,
    category,
    defaultLocation,
    defaultUnit,
    per100g,
    unitWeights: o.unitWeights,
    density: o.density,
    packageQty: o.pkg?.[0],
    packageUnit: o.pkg?.[1],
    packagePrice: o.pkg?.[2],
    priceSource: 'estimate',
    priceCheckedAt: TODAY,
    staple: o.staple,
    nonFood: o.nonFood,
    substitutes: o.substitutes,
    cheaperAlternatives: o.cheaper,
    preferredStoreId: o.store,
  };
}

const SPICE = n(300, 10, 50, 8, 25);
const spice = (id: string, name: string) =>
  ing(id, name, 'spices', 'pantry', 'jar', SPICE, {
    unitWeights: { jar: 100 },
    density: 0.5,
    pkg: [1, 'jar', 3],
    staple: true,
    store: 'walmart',
  });

export const seedIngredients: Ingredient[] = [
  // ── Meat & protein ──
  ing('chicken-breast', 'Chicken breast', 'protein', 'fridge', 'lb', n(120, 22.5, 0, 2.6, 0), {
    unitWeights: { each: 230 }, pkg: [2, 'lb', 7.5], substitutes: ['chicken-thigh'], cheaper: ['chicken-thigh'], store: 'traderjoes',
  }),
  ing('chicken-thigh', 'Chicken thighs (boneless)', 'protein', 'fridge', 'lb', n(121, 19.7, 0, 4.1, 0), {
    unitWeights: { each: 110 }, pkg: [2, 'lb', 6], substitutes: ['chicken-breast'], store: 'walmart',
  }),
  ing('ground-chicken', 'Ground chicken', 'protein', 'fridge', 'lb', n(143, 17.4, 0, 8.1, 0), {
    pkg: [1, 'lb', 5], substitutes: ['chicken-breast'], store: 'traderjoes',
  }),
  ing('tofu', 'Tofu (extra firm)', 'protein', 'fridge', 'pack', n(144, 17.3, 2.8, 8.7, 2.3), {
    unitWeights: { pack: 397 }, pkg: [1, 'pack', 2.5], substitutes: ['paneer'], store: 'traderjoes',
  }),
  ing('paneer', 'Paneer', 'protein', 'fridge', 'pack', n(321, 25, 3.6, 25, 0), {
    unitWeights: { pack: 397 }, pkg: [1, 'pack', 5.5], substitutes: ['tofu'], cheaper: ['tofu'],
  }),
  ing('canned-tuna', 'Canned tuna (in water)', 'protein', 'pantry', 'can', n(116, 25.5, 0, 0.8, 0), {
    unitWeights: { can: 120 }, pkg: [1, 'can', 1.3], store: 'walmart',
  }),

  // ── Dairy & eggs ──
  ing('eggs', 'Eggs', 'dairy', 'fridge', 'each', n(143, 12.6, 0.7, 9.5, 0), {
    unitWeights: { each: 50, dozen: 600 }, pkg: [12, 'each', 3.5], store: 'walmart',
  }),
  ing('greek-yogurt', 'Greek yogurt (plain, nonfat)', 'dairy', 'fridge', 'container', n(59, 10.3, 3.6, 0.4, 0), {
    unitWeights: { container: 907 }, density: 1.05, pkg: [1, 'container', 5], store: 'traderjoes',
  }),
  ing('milk', 'Milk (2%)', 'dairy', 'fridge', 'gal', n(50, 3.3, 4.8, 2, 0), {
    density: 1.03, pkg: [1, 'gal', 3.8], store: 'walmart',
  }),
  ing('mozzarella', 'Low-moisture mozzarella', 'dairy', 'fridge', 'oz', n(300, 24, 3, 20, 0), {
    density: 0.45, pkg: [16, 'oz', 4.5], store: 'traderjoes',
  }),
  ing('butter', 'Butter', 'dairy', 'fridge', 'lb', n(717, 0.9, 0.1, 81, 0), {
    density: 0.96, pkg: [1, 'lb', 4.5],
  }),
  ing('heavy-cream', 'Heavy cream', 'dairy', 'fridge', 'floz', n(340, 2.8, 2.7, 36, 0), {
    density: 1.0, pkg: [16, 'floz', 3.5], substitutes: ['greek-yogurt'],
  }),
  ing('cream-cheese', 'Cream cheese', 'dairy', 'fridge', 'oz', n(350, 6.2, 5.5, 34, 0), {
    density: 1.0, pkg: [8, 'oz', 2.5],
  }),
  ing('cottage-cheese', 'Cottage cheese (2%)', 'dairy', 'fridge', 'container', n(84, 11, 4.3, 2.3, 0), {
    unitWeights: { container: 680 }, density: 1.0, pkg: [1, 'container', 4], store: 'walmart',
  }),

  // ── Vegetables ──
  ing('onion', 'Onions', 'vegetables', 'pantry', 'each', n(40, 1.1, 9.3, 0.1, 1.7), {
    unitWeights: { each: 150 }, pkg: [3, 'lb', 3.5],
  }),
  ing('tomato', 'Tomatoes', 'vegetables', 'pantry', 'each', n(18, 0.9, 3.9, 0.2, 1.2), {
    unitWeights: { each: 123 }, pkg: [4, 'each', 2.5],
  }),
  ing('potato', 'Potatoes', 'vegetables', 'pantry', 'each', n(77, 2, 17.5, 0.1, 2.2), {
    unitWeights: { each: 213 }, pkg: [5, 'lb', 4],
  }),
  ing('cucumber', 'Cucumber', 'vegetables', 'fridge', 'each', n(15, 0.7, 3.6, 0.1, 0.5), {
    unitWeights: { each: 300 }, pkg: [1, 'each', 0.9],
  }),
  ing('carrot', 'Carrots', 'vegetables', 'fridge', 'each', n(41, 0.9, 9.6, 0.2, 2.8), {
    unitWeights: { each: 61 }, pkg: [2, 'lb', 2],
  }),
  ing('cauliflower', 'Cauliflower', 'vegetables', 'fridge', 'head', n(25, 1.9, 5, 0.3, 2), {
    unitWeights: { head: 575 }, pkg: [1, 'head', 3],
  }),
  ing('ginger-garlic-paste', 'Ginger-garlic paste', 'vegetables', 'fridge', 'jar', n(90, 2.5, 15, 2, 2), {
    unitWeights: { jar: 283 }, density: 1.1, pkg: [1, 'jar', 3.5],
  }),
  ing('bell-pepper', 'Bell pepper', 'vegetables', 'fridge', 'each', n(26, 1, 6, 0.3, 2.1), {
    unitWeights: { each: 120 }, pkg: [1, 'each', 1.25], cheaper: ['frozen-veg'],
  }),
  ing('broccoli', 'Broccoli', 'vegetables', 'fridge', 'head', n(34, 2.8, 6.6, 0.4, 2.6), {
    unitWeights: { head: 300 }, pkg: [1, 'head', 2.5], cheaper: ['frozen-veg'],
  }),
  ing('spinach', 'Spinach', 'vegetables', 'fridge', 'bag', n(23, 2.9, 3.6, 0.4, 2.2), {
    unitWeights: { bag: 284 }, density: 0.13, pkg: [1, 'bag', 3],
  }),
  ing('lettuce', 'Romaine lettuce', 'vegetables', 'fridge', 'head', n(17, 1.2, 3.3, 0.3, 2.1), {
    unitWeights: { head: 450 }, density: 0.2, pkg: [1, 'head', 2.5],
  }),
  ing('frozen-veg', 'Frozen mixed vegetables', 'frozen', 'freezer', 'bag', n(65, 3, 13, 0.5, 4), {
    unitWeights: { bag: 454 }, density: 0.55, pkg: [1, 'bag', 2], store: 'traderjoes',
  }),
  ing('mushrooms', 'Mushrooms', 'vegetables', 'fridge', 'pack', n(22, 3.1, 3.3, 0.3, 1), {
    unitWeights: { pack: 227 }, pkg: [1, 'pack', 2.5],
  }),
  ing('zucchini', 'Zucchini', 'vegetables', 'fridge', 'each', n(17, 1.2, 3.1, 0.3, 1), {
    unitWeights: { each: 200 }, pkg: [1, 'each', 1],
  }),
  ing('cilantro', 'Cilantro', 'vegetables', 'fridge', 'bunch', n(23, 2.1, 3.7, 0.5, 2.8), {
    unitWeights: { bunch: 50 }, density: 0.07, pkg: [1, 'bunch', 1],
  }),
  ing('lime', 'Lime', 'fruits', 'fridge', 'each', n(30, 0.7, 10.5, 0.2, 2.8), {
    unitWeights: { each: 67 }, pkg: [1, 'each', 0.5], substitutes: ['lemon-juice'],
  }),
  ing('avocado', 'Avocado', 'fruits', 'pantry', 'each', n(160, 2, 8.5, 14.7, 6.7), {
    unitWeights: { each: 150 }, pkg: [1, 'each', 1.25],
  }),

  // ── Fruits ──
  ing('pear', 'Pear', 'fruits', 'fridge', 'each', n(57, 0.4, 15.2, 0.1, 3.1), {
    unitWeights: { each: 178 }, pkg: [1, 'each', 0.9],
  }),
  ing('banana', 'Banana', 'fruits', 'pantry', 'each', n(89, 1.1, 22.8, 0.3, 2.6), {
    unitWeights: { each: 118 }, pkg: [6, 'each', 1.6],
  }),
  ing('apple', 'Apple', 'fruits', 'fridge', 'each', n(52, 0.3, 13.8, 0.2, 2.4), {
    unitWeights: { each: 182 }, pkg: [1, 'each', 0.9],
  }),
  ing('frozen-berries', 'Frozen berries', 'frozen', 'freezer', 'bag', n(50, 0.7, 12, 0.3, 3.5), {
    unitWeights: { bag: 454 }, density: 0.6, pkg: [1, 'bag', 4], store: 'traderjoes',
  }),

  // ── Grains & bread ──
  ing('wheat-bread', 'Wheat bread', 'grains', 'pantry', 'pack', n(254, 12.3, 43, 3.5, 6), {
    unitWeights: { slice: 32, pack: 567 }, pkg: [1, 'pack', 3],
  }),
  ing('flour-tortilla', 'Flour tortillas', 'grains', 'pantry', 'each', n(304, 8.2, 50, 7.5, 3.5), {
    unitWeights: { each: 45, pack: 450 }, pkg: [10, 'each', 3], store: 'walmart',
  }),
  ing('atta', 'Atta (whole wheat flour)', 'grains', 'pantry', 'lb', n(340, 13, 72, 2.5, 10.7), {
    density: 0.51, pkg: [10, 'lb', 9],
  }),
  ing('burger-bun', 'Burger buns', 'grains', 'pantry', 'each', n(279, 9.7, 49, 4.3, 2.7), {
    unitWeights: { each: 52, pack: 416 }, pkg: [8, 'each', 2.5],
  }),
  ing('bagel', 'Bagels', 'grains', 'pantry', 'each', n(257, 10, 50, 1.5, 2.1), {
    unitWeights: { each: 105 }, pkg: [6, 'each', 3.5],
  }),
  ing('basmati-rice', 'White / basmati rice', 'grains', 'pantry', 'lb', n(360, 7, 79, 0.6, 1.3), {
    density: 0.78, pkg: [10, 'lb', 14], store: 'walmart',
  }),
  ing('vermicelli', 'Vermicelli (sevai)', 'grains', 'pantry', 'pack', n(360, 12, 74, 1.5, 3), {
    unitWeights: { pack: 400 }, density: 0.4, pkg: [1, 'pack', 2.5],
  }),
  ing('pasta', 'Pasta (dry)', 'grains', 'pantry', 'lb', n(371, 13, 75, 1.5, 3.2), {
    density: 0.45, pkg: [1, 'lb', 1.5], substitutes: ['protein-pasta'],
  }),
  ing('protein-pasta', 'Protein pasta (dry)', 'grains', 'pantry', 'box', n(355, 17, 65, 2.5, 5.5), {
    unitWeights: { box: 411 }, density: 0.45, pkg: [1, 'box', 2.75], substitutes: ['pasta'], cheaper: ['pasta'],
  }),
  ing('oats', 'Rolled oats', 'grains', 'pantry', 'oz', n(379, 13.2, 67.7, 6.5, 10.1), {
    density: 0.34, pkg: [18, 'oz', 3],
  }),
  ing('granola', 'Granola (loose)', 'snacks', 'pantry', 'oz', n(471, 10, 64, 20, 7), {
    density: 0.5, pkg: [12, 'oz', 4], substitutes: ['granola-bar'],
  }),

  // ── Beans & legumes ──
  ing('rajma', 'Rajma (dry kidney beans)', 'legumes', 'pantry', 'lb', n(333, 24, 60, 0.8, 25), {
    density: 0.78, pkg: [2, 'lb', 3], substitutes: ['black-beans-can'],
  }),
  ing('chana', 'Chana (dry chickpeas)', 'legumes', 'pantry', 'lb', n(378, 20.5, 63, 6, 12.2), {
    density: 0.85, pkg: [2, 'lb', 3], substitutes: ['chickpeas-can'],
  }),
  ing('chickpeas-can', 'Chickpeas (canned)', 'legumes', 'pantry', 'can', n(139, 7.1, 22.5, 2.6, 7.6), {
    unitWeights: { can: 250 }, pkg: [1, 'can', 1.1], substitutes: ['chana'],
  }),
  ing('toor-dal', 'Toor dal', 'legumes', 'pantry', 'lb', n(343, 22, 63, 1.5, 15), {
    density: 0.85, pkg: [2, 'lb', 4],
  }),
  ing('black-beans-can', 'Black beans (canned)', 'legumes', 'pantry', 'can', n(132, 8.9, 23.7, 0.5, 8.7), {
    unitWeights: { can: 250 }, pkg: [1, 'can', 1.1], substitutes: ['rajma'],
  }),

  // ── Sauces & condiments ──
  ing('mayonnaise', 'Mayonnaise', 'sauces', 'fridge', 'jar', n(680, 1, 0.6, 75, 0), {
    unitWeights: { jar: 850 }, density: 0.91, pkg: [1, 'jar', 4], substitutes: ['greek-yogurt'],
  }),
  ing('mustard', 'Mustard', 'sauces', 'fridge', 'bottle', n(60, 3.7, 5.8, 3.3, 4), {
    unitWeights: { bottle: 400 }, density: 1.05, pkg: [1, 'bottle', 1.5],
  }),
  ing('sriracha', 'Sriracha', 'sauces', 'fridge', 'bottle', n(93, 1.9, 19, 0.9, 2.2), {
    unitWeights: { bottle: 482 }, density: 1.1, pkg: [1, 'bottle', 4],
  }),
  ing('soy-sauce', 'Soy sauce', 'sauces', 'pantry', 'bottle', n(53, 8.1, 4.9, 0.6, 0.8), {
    unitWeights: { bottle: 340 }, density: 1.15, pkg: [1, 'bottle', 2.5],
  }),
  ing('green-chutney', 'Green chutney', 'sauces', 'fridge', 'jar', n(70, 2, 8, 3, 3), {
    unitWeights: { jar: 300 }, density: 1.05, pkg: [1, 'jar', 3],
  }),
  ing('honey', 'Honey', 'sauces', 'pantry', 'bottle', n(304, 0.3, 82, 0, 0.2), {
    unitWeights: { bottle: 340 }, density: 1.42, pkg: [1, 'bottle', 5],
  }),
  ing('jam', 'Jam', 'sauces', 'fridge', 'jar', n(250, 0.4, 63, 0.1, 1), {
    unitWeights: { jar: 510 }, density: 1.33, pkg: [1, 'jar', 3],
  }),
  ing('pasta-sauce', 'Pasta sauce (marinara)', 'sauces', 'pantry', 'jar', n(50, 1.5, 8, 1.5, 2), {
    unitWeights: { jar: 680 }, density: 1.04, pkg: [1, 'jar', 2.5],
  }),
  ing('salsa', 'Salsa', 'sauces', 'fridge', 'jar', n(36, 1.5, 7, 0.2, 1.8), {
    unitWeights: { jar: 454 }, density: 1.05, pkg: [1, 'jar', 3],
  }),
  ing('thai-curry-paste', 'Thai curry paste (red/green)', 'sauces', 'fridge', 'jar', n(100, 2, 14, 3, 4), {
    unitWeights: { jar: 113 }, density: 1.1, pkg: [1, 'jar', 3],
  }),
  ing('coconut-milk', 'Light coconut milk', 'sauces', 'pantry', 'can', n(75, 0.7, 1.5, 7, 0), {
    unitWeights: { can: 400 }, density: 1.0, pkg: [1, 'can', 2.5], substitutes: ['heavy-cream'],
  }),
  ing('canned-tomatoes', 'Canned crushed tomatoes', 'sauces', 'pantry', 'can', n(32, 1.6, 7, 0.3, 1.9), {
    unitWeights: { can: 411 }, density: 1.05, pkg: [1, 'can', 1.2], substitutes: ['tomato', 'pasta-sauce'],
  }),
  ing('peanut-butter', 'Peanut butter', 'sauces', 'pantry', 'jar', n(588, 25, 20, 50, 6), {
    unitWeights: { jar: 454 }, density: 1.1, pkg: [1, 'jar', 3],
  }),

  // ── Spices ──
  spice('turmeric', 'Turmeric'),
  spice('red-chili-powder', 'Red chili powder'),
  spice('kashmiri-chili', 'Kashmiri chili powder'),
  spice('cumin-seeds', 'Cumin seeds'),
  spice('cumin-powder', 'Cumin powder'),
  spice('coriander-powder', 'Coriander powder'),
  spice('garam-masala', 'Garam masala'),
  spice('chaat-masala', 'Chaat masala'),
  spice('tandoori-masala', 'Tandoori masala'),
  spice('tikka-masala-spice', 'Chicken tikka masala (spice mix)'),
  spice('pav-bhaji-masala', 'Pav bhaji masala'),
  spice('kasuri-methi', 'Kasuri methi'),
  { ...spice('salt', 'Salt'), per100g: n(0, 0, 0, 0, 0), density: 1.2 },
  spice('black-pepper', 'Black pepper'),
  spice('garlic-powder', 'Garlic powder'),
  spice('onion-powder', 'Onion powder'),
  spice('paprika', 'Paprika'),
  spice('oregano', 'Oregano'),
  spice('italian-seasoning', 'Italian seasoning'),
  spice('chili-flakes', 'Chili flakes'),
  spice('cinnamon', 'Cinnamon'),

  // ── Oils & cooking ──
  ing('canola-oil', 'Canola oil', 'oils', 'pantry', 'bottle', n(884, 0, 0, 100, 0), {
    unitWeights: { bottle: 1300 }, density: 0.92, pkg: [1, 'bottle', 4.5], staple: false,
  }),
  ing('avocado-oil-spray', 'Avocado oil spray', 'oils', 'pantry', 'can', n(884, 0, 0, 100, 0), {
    unitWeights: { can: 170 }, density: 0.92, pkg: [1, 'can', 6], substitutes: ['canola-oil'],
  }),
  ing('lemon-juice', 'Lemon juice', 'oils', 'fridge', 'bottle', n(22, 0.4, 6.9, 0.2, 0.3), {
    unitWeights: { bottle: 455 }, density: 1.03, pkg: [1, 'bottle', 3], substitutes: ['lime'],
  }),

  // ── Snacks & beverages ──
  ing('chips', 'Chips', 'snacks', 'pantry', 'bag', n(536, 7, 53, 34, 4.4), {
    unitWeights: { bag: 226 }, pkg: [1, 'bag', 4], cheaper: ['popcorn-kernels'],
  }),
  ing('granola-bar', 'Crunchy granola bars (2-bar pouch)', 'snacks', 'pantry', 'each', n(452, 7.1, 69, 16.7, 4.8), {
    unitWeights: { each: 42, box: 504 }, pkg: [12, 'each', 4.5], substitutes: ['granola'],
  }),
  ing('popcorn-kernels', 'Popcorn kernels', 'snacks', 'pantry', 'jar', n(375, 11, 74, 4.5, 13), {
    unitWeights: { jar: 850 }, density: 0.6, pkg: [1, 'jar', 3.5],
  }),
  ing('dark-chocolate', 'Dark chocolate (70%+)', 'snacks', 'pantry', 'each', n(598, 7.8, 46, 43, 11), {
    unitWeights: { each: 100 }, pkg: [1, 'each', 3], store: 'traderjoes',
  }),
  ing('coffee', 'Coffee', 'drinks', 'pantry', 'bag', undefined, {
    unitWeights: { bag: 340 }, pkg: [1, 'bag', 9],
  }),
  ing('diet-soda', 'Coke Zero / Diet Coke', 'drinks', 'drinks', 'can', n(0, 0, 0, 0, 0), {
    unitWeights: { can: 355 }, density: 1, pkg: [12, 'can', 7.5],
  }),
  ing('juice', 'Juice', 'drinks', 'drinks', 'bottle', n(45, 0.5, 10.4, 0.1, 0.2), {
    unitWeights: { bottle: 1600 }, density: 1.04, pkg: [1, 'bottle', 3.5],
  }),

  // ── Water ──
  ing('water-bottle', 'Bottled water', 'water', 'drinks', 'bottle', undefined, {
    pkg: [24, 'bottle', 4.5], store: 'walmart',
  }),
  ing('water-gallon', 'Gallon water', 'water', 'drinks', 'gal', undefined, {
    pkg: [1, 'gal', 1.5], store: 'walmart',
  }),

  // ── Household ──
  ing('paper-towels', 'Paper towels', 'household', 'other', 'pack', undefined, { pkg: [1, 'pack', 8], nonFood: true, store: 'target' }),
  ing('dish-soap', 'Dish soap', 'household', 'other', 'bottle', undefined, { pkg: [1, 'bottle', 3], nonFood: true, store: 'target' }),
  ing('trash-bags', 'Trash bags', 'household', 'other', 'box', undefined, { pkg: [1, 'box', 9], nonFood: true, store: 'walmart' }),
  ing('foil', 'Aluminum foil', 'household', 'other', 'each', undefined, { pkg: [1, 'each', 4], nonFood: true }),
  ing('zip-bags', 'Zip-top bags', 'household', 'other', 'box', undefined, { pkg: [1, 'box', 4], nonFood: true }),
  ing('meal-prep-containers', 'Meal prep containers', 'household', 'other', 'pack', undefined, { pkg: [1, 'pack', 12], nonFood: true }),
];
