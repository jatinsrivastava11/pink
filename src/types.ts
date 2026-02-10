// ───────────────────────────────────────────────────────────────
// Core data model for Pink Kitchen.
// Every recipe ingredient and inventory item references an Ingredient
// by a stable `ingredientId`, which is what connects
// inventory → recipes → meal plan → grocery list → restocking.
// ───────────────────────────────────────────────────────────────

export type Unit =
  // mass
  | 'g' | 'kg' | 'oz' | 'lb'
  // volume
  | 'ml' | 'l' | 'tsp' | 'tbsp' | 'cup' | 'floz' | 'gal'
  // count / package
  | 'each' | 'slice' | 'clove' | 'can' | 'container' | 'bottle' | 'pack' | 'bag' | 'box' | 'jar' | 'head' | 'bunch' | 'dozen';

export type GroceryCategory =
  | 'protein' | 'dairy' | 'vegetables' | 'fruits' | 'grains' | 'legumes'
  | 'sauces' | 'spices' | 'oils' | 'snacks' | 'drinks' | 'water' | 'household' | 'frozen' | 'other';

/** Storage location id. Built-ins plus user-defined ids. */
export type LocationId = string;

export type Cuisine = 'Indian' | 'Mexican' | 'Asian' | 'Western' | 'Italian' | 'Fusion';
export type MealCategory = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export type RecipeTag =
  | 'very-filling' | 'high-protein' | 'lower-calorie-density' | 'quick' | 'meal-prep'
  | 'pre-workout' | 'post-workout' | 'light' | 'evening-meal' | 'evening-snack'
  | 'craving-friendly' | 'uses-expiring' | 'budget-friendly' | 'no-cook' | 'sweet' | 'crunchy';

/** Nutrition per 100 g (estimates, USDA-style generic values). */
export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export type PriceSource = 'estimate' | 'manual' | 'verified';

/** Catalog entry: the canonical identity of a food/product. */
export interface Ingredient {
  id: string;
  name: string;
  category: GroceryCategory;
  defaultLocation: LocationId;
  /** Unit used when buying/stocking (e.g. lb for chicken, each for eggs). */
  defaultUnit: Unit;
  /** Nutrition per 100 g. Omitted for non-food (water, household). */
  per100g?: Nutrients;
  /** Grams per one of a count unit, e.g. { each: 50 } for eggs, { slice: 32 } for bread. */
  unitWeights?: Partial<Record<Unit, number>>;
  /** g per ml for volume → mass conversion (default 1). */
  density?: number;
  /** Typical purchase package (used for rounding grocery quantities). */
  packageQty?: number;
  packageUnit?: Unit;
  /** Estimated price for one package (USD). */
  packagePrice?: number;
  priceSource?: PriceSource;
  priceCheckedAt?: string;
  /** Pantry staples whose quantities are hard to track (spices, salt). */
  staple?: boolean;
  /** Non-food (household) */
  nonFood?: boolean;
  /** Ingredient ids that can substitute this one in recipes. */
  substitutes?: string[];
  /** Cheaper alternative ids (budget mode). */
  cheaperAlternatives?: string[];
  /** Preferred store id. */
  preferredStoreId?: string;
}

export interface InventoryItem {
  id: string;
  ingredientId: string;
  name: string;
  category: GroceryCategory;
  location: LocationId;
  /** null → "Quantity not specified" (unknown, needs verification). */
  quantity: number | null;
  unit: Unit;
  /** Low-stock threshold, null → none */
  minQuantity: number | null;
  purchaseDate?: string;
  expirationDate?: string;
  brand?: string;
  notes?: string;
  price?: number;
  frequent?: boolean;
  /** Explicitly marked out of stock. */
  outOfStock?: boolean;
  /** Water bottles: size in fl oz per bottle. */
  bottleSizeOz?: number;
  updatedAt: string;
}

export interface RecipeIngredient {
  ingredientId: string;
  quantity: number;
  unit: Unit;
  optional?: boolean;
  note?: string;
}

export interface Recipe {
  id: string;
  name: string;
  image?: string; // path under /food/ or data URL
  emoji?: string;
  cuisine: Cuisine;
  category: MealCategory;
  prepMin: number;
  cookMin: number;
  servings: number;
  ingredients: RecipeIngredient[];
  steps: string[];
  tags: RecipeTag[];
  storage: string;
  reheating: string;
  description?: string;
  notes?: string;
  favorite?: boolean;
  rating?: number; // 0-5
  frequent?: boolean;
  /** Days it keeps in fridge (conservative). */
  fridgeDays?: number;
  /** Days it keeps in freezer, 0/undefined = not recommended. */
  freezerDays?: number;
  /** Manual nutrition per serving overriding calculated values. */
  nutritionOverride?: Nutrients;
  isSeed?: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PreparedMeal {
  id: string;
  recipeId?: string;
  name: string;
  servings: number;
  location: LocationId;
  preparedDate?: string;
  expirationDate?: string;
  /** per-serving nutrition estimate */
  nutrition?: Nutrients;
  reheating?: string;
  notes?: string;
  updatedAt: string;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack' | 'any';

export interface MealPlanEntry {
  id: string;
  date: string; // YYYY-MM-DD
  slot: MealSlot;
  recipeId?: string;
  preparedMealId?: string;
  customName?: string;
  servings: number;
  status: 'planned' | 'eaten' | 'skipped' | 'prepared';
  note?: string;
  order: number;
}

export interface MealPlan {
  entries: MealPlanEntry[];
  /** dates flagged as workout days */
  workoutDays: string[];
}

export interface Store {
  id: string;
  name: string;
  color: string;
}

export interface PriceRecord {
  id: string;
  ingredientId: string;
  storeId: string;
  price: number;
  packageQty: number;
  packageUnit: Unit;
  source: PriceSource;
  checkedAt: string;
}

export interface GroceryItem {
  id: string;
  ingredientId?: string;
  name: string;
  category: GroceryCategory;
  /** quantity to buy, in `unit` */
  quantity: number;
  unit: Unit;
  /** how much is needed by the plan (in unit), for display */
  neededQty?: number;
  haveQty?: number | null;
  estPrice: number;
  priceSource: PriceSource;
  storeId?: string;
  reason: 'recipe' | 'low-stock' | 'manual' | 'substitute';
  /** essential = required for selected meals */
  essential: boolean;
  /** needs verification (unknown inventory quantity) */
  verify?: boolean;
  checked: boolean;
  alreadyHave?: boolean;
  removed?: boolean;
  forRecipes?: string[];
  actualPrice?: number;
  purchasedQty?: number;
  location?: LocationId;
}

export interface GroceryList {
  id: string;
  name: string;
  createdAt: string;
  items: GroceryItem[];
}

export interface Budget {
  amount: number;
  strict: boolean;
}

export interface ShoppingTrip {
  id: string;
  storeId: string;
  budget: Budget;
  days: number;
  includeNonFood: boolean;
  priority: 'cost' | 'convenience';
  status: 'planning' | 'shopping' | 'completed' | 'cancelled';
  recipeSelections: { recipeId: string; servings: number }[];
  list: GroceryList;
  estimatedTotal: number;
  actualTotal?: number;
  createdAt: string;
  completedAt?: string;
}

export interface WaterLog {
  id: string;
  date: string;
  time: string;
  amountOz: number;
  kind: 'glass' | 'bottle' | 'custom';
  stockItemId?: string;
}

export interface WeightLog {
  id: string;
  date: string;
  weightLb: number;
  waistIn?: number;
  chestIn?: number;
  note?: string;
}

export interface FoodLog {
  id: string;
  date: string;
  time: string;
  name: string;
  recipeId?: string;
  preparedMealId?: string;
  servings: number;
  nutrition: Nutrients; // total for this log
  slot: MealSlot;
}

export interface WorkoutLog {
  id: string;
  date: string;
  session: 'A' | 'B' | 'walk';
  minutes?: number;
  note?: string;
}

export interface ProgressPhotoMeta {
  id: string;
  date: string;
  note?: string;
}

export interface UserPreferences {
  name: string;
  age: number | null;
  ageConfirmed: boolean;
  sex: 'male' | 'female';
  heightIn: number;
  weightLb: number;
  goalWeightLb: number;
  activity: 'sedentary' | 'light' | 'moderate' | 'active';
  goal: string;
  proteinTarget: number;
  /** null until confirmed */
  calorieTarget: number | null;
  carbTarget: number | null;
  fatTarget: number | null;
  fiberTarget: number;
  waterGoalOz: number;
  glassOz: number;
  defaultBottleOz: number;
  deductBottleOnLog: boolean;
  units: 'imperial' | 'metric';
  cuisines: Cuisine[];
  spice: 'mild' | 'medium' | 'hot';
  mealPrepPerWeek: number;
  defaultBudget: number;
  favoriteStores: string[];
  lowStockDefault: number;
  trainingEnabled: boolean;
  onboarded: boolean;
}

export interface Location {
  id: LocationId;
  name: string;
  icon: string; // lucide icon key
  builtin?: boolean;
}

export interface AppData {
  version: number;
  prefs: UserPreferences;
  locations: Location[];
  ingredients: Ingredient[];
  inventory: InventoryItem[];
  recipes: Recipe[];
  prepared: PreparedMeal[];
  plan: MealPlan;
  stores: Store[];
  prices: PriceRecord[];
  trips: ShoppingTrip[];
  waterLogs: WaterLog[];
  weightLogs: WeightLog[];
  foodLogs: FoodLog[];
  workoutLogs: WorkoutLog[];
  photos: ProgressPhotoMeta[];
  groceryDraft: GroceryList;
}
