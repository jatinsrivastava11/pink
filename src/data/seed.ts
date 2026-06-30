import type { AppData, InventoryItem, Location, PreparedMeal, Store, UserPreferences, Ingredient } from '../types';
import { seedIngredients } from './ingredients';
import { seedRecipes } from './recipes';

export const DATA_VERSION = 1;
const NOW = new Date().toISOString();

export const defaultLocations: Location[] = [
  { id: 'fridge', name: 'Fridge', icon: 'refrigerator', builtin: true },
  { id: 'freezer', name: 'Freezer', icon: 'snowflake', builtin: true },
  { id: 'pantry', name: 'Pantry', icon: 'archive', builtin: true },
  { id: 'drinks', name: 'Drinks & water', icon: 'cup-soda', builtin: true },
  { id: 'other', name: 'Other storage', icon: 'box', builtin: true },
];

export const defaultStores: Store[] = [
  { id: 'traderjoes', name: "Trader Joe's", color: '#b5442e' },
  { id: 'walmart', name: 'Walmart', color: '#1f63c6' },
  { id: 'target', name: 'Target', color: '#cc1f2f' },
];

export const defaultPrefs: UserPreferences = {
  name: 'Jatin',
  age: null,
  ageConfirmed: false,
  sex: 'male',
  heightIn: 73,
  weightLb: 176,
  goalWeightLb: 160,
  activity: 'light',
  goal: 'Sustainable fat loss & body recomposition — lose fat, keep/build muscle, look leaner and more athletic.',
  proteinTarget: 130,
  calorieTarget: null,
  carbTarget: null,
  fatTarget: null,
  fiberTarget: 30,
  waterGoalOz: 96,
  glassOz: 8,
  defaultBottleOz: 16.9,
  deductBottleOnLog: true,
  units: 'imperial',
  cuisines: ['Indian', 'Mexican', 'Asian', 'Western', 'Italian'],
  spice: 'medium',
  mealPrepPerWeek: 2,
  defaultBudget: 60,
  favoriteStores: ['traderjoes', 'walmart', 'target'],
  lowStockDefault: 1,
  trainingEnabled: true,
  onboarded: false,
};

/**
 * The user's actual kitchen. Quantities were not provided, so they are `null`
 * ("Quantity not specified") until verified. Min quantities are editable
 * low-stock preferences, not inventory claims.
 */
type Seed = [ingredientId: string, opts?: Partial<InventoryItem>];

const seedList: Seed[] = [
  // A. Meat & protein
  ['chicken-breast', { minQuantity: 1, frequent: true }],
  ['chicken-thigh', { minQuantity: 1, frequent: true }],
  ['tofu', { frequent: false }],
  ['paneer', { frequent: true }],
  ['ground-chicken', { quantity: 0, outOfStock: true, frequent: true, notes: 'Used up making the 4 prepped chicken burgers.' }],
  // B. Dairy & eggs
  ['eggs', { minQuantity: 6, frequent: true }],
  ['greek-yogurt', { minQuantity: 1, frequent: true }],
  ['milk', { frequent: true, notes: 'Also used for coffee.' }],
  ['mozzarella'],
  ['butter'],
  ['heavy-cream'],
  ['cream-cheese'],
  // C. Vegetables
  ['onion', { minQuantity: 2, frequent: true }],
  ['tomato', { minQuantity: 2, frequent: true }],
  ['potato'],
  ['cucumber', { frequent: true }],
  ['carrot'],
  ['cauliflower'],
  ['ginger-garlic-paste', { frequent: true }],
  // D. Fruits
  ['pear'],
  // E. Grains
  ['wheat-bread', { frequent: true }],
  ['flour-tortilla', { frequent: true }],
  ['atta'],
  ['burger-bun', { notes: 'Separate from the buns already used in the 4 prepped burgers.' }],
  ['bagel'],
  ['basmati-rice', { frequent: true }],
  ['vermicelli'],
  // F. Legumes
  ['rajma'],
  ['chana'],
  ['toor-dal'],
  // G. Sauces
  ['mayonnaise'],
  ['mustard'],
  ['sriracha'],
  ['soy-sauce'],
  ['green-chutney'],
  ['honey'],
  ['jam'],
  ['pasta-sauce'],
  // H. Spices
  ...[
    'turmeric', 'red-chili-powder', 'kashmiri-chili', 'cumin-seeds', 'cumin-powder', 'coriander-powder', 'garam-masala',
    'chaat-masala', 'tandoori-masala', 'tikka-masala-spice', 'pav-bhaji-masala', 'kasuri-methi', 'salt', 'black-pepper',
    'garlic-powder', 'onion-powder', 'paprika', 'oregano', 'italian-seasoning', 'chili-flakes', 'cinnamon',
  ].map((id) => [id] as Seed),
  // I. Oils
  ['canola-oil'],
  ['avocado-oil-spray'],
  ['lemon-juice'],
  // J. Snacks & beverages
  ['chips'],
  ['granola-bar', { frequent: true }],
  ['coffee', { frequent: true }],
  ['diet-soda'],
  ['juice'],
  // K. Water
  ['water-bottle', { bottleSizeOz: 16.9, minQuantity: 6, frequent: true }],
];

export function buildSeedInventory(ingredients: Ingredient[]): InventoryItem[] {
  const map = new Map(ingredients.map((i) => [i.id, i]));
  return seedList.map(([id, o], idx) => {
    const ing = map.get(id)!;
    return {
      id: `inv-${id}`,
      ingredientId: id,
      name: ing.name,
      category: ing.category,
      location: ing.defaultLocation,
      quantity: null,
      unit: ing.defaultUnit,
      minQuantity: null,
      price: ing.packagePrice,
      updatedAt: NOW,
      ...o,
    } satisfies InventoryItem;
  });
}

export const seedPrepared: PreparedMeal[] = [
  {
    id: 'prep-chicken-burgers',
    recipeId: 'ground-chicken-burger',
    name: 'Ground chicken burger (prepped)',
    servings: 4,
    location: 'fridge',
    notes:
      'Already assembled: ground chicken patty, seasoning, sauces, burger bun. Prep date / storage location not specified — please verify. The raw ground chicken used for these is depleted.',
    nutrition: { kcal: 470, protein: 34, carbs: 33, fat: 21, fiber: 2 },
    reheating:
      'Separate bun if possible. Microwave patty covered 60–90 s until steaming hot (165 °F / 74 °C); toast the bun.',
    updatedAt: NOW,
  },
];

export function buildSeedData(): AppData {
  const ingredients = structuredClone(seedIngredients);
  return {
    version: DATA_VERSION,
    prefs: structuredClone(defaultPrefs),
    locations: structuredClone(defaultLocations),
    ingredients,
    inventory: buildSeedInventory(ingredients),
    recipes: structuredClone(seedRecipes),
    prepared: structuredClone(seedPrepared),
    plan: { entries: [], workoutDays: [] },
    stores: structuredClone(defaultStores),
    prices: [],
    trips: [],
    waterLogs: [],
    weightLogs: [],
    foodLogs: [],
    workoutLogs: [],
    photos: [],
    groceryDraft: { id: 'draft', name: 'Grocery list', createdAt: NOW, items: [] },
  };
}
