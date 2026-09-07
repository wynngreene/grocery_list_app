const ingredientTypes = [
  'Produce',
  'Fruit',
  'Meat',
  'Seafood',
  'Dairy',
  'Eggs',
  'Bakery',
  'Dry Goods',
  'Canned Goods',
  'Frozen',
  'Herbs',
  'Spices',
  'Sauces',
  'Condiments',
  'Beverages',
  'Snacks',
  'Household',
  'Other'
];

const stores = ['Walmart', 'Costco', 'Target', 'King Soopers', 'Other'];

const STORAGE_KEY = 'weekly_grocery_app_state';

// Shown on the intro screen. Bump APP_VERSION / APP_LAST_UPDATED together
// with every update/change that ships — this is the running version number,
// not tied to DATA_VERSION (which only tracks the starter-data shape).
const APP_VERSION = '2.1';
const APP_LAST_UPDATED = 'September 7, 2026';

// Bump this whenever the starter data (data/recipes.json / data/week_meals.json /
// data/ingredients.json) changes shape. A saved localStorage state from an
// older version is treated as stale and discarded so everyone picks up the
// new defaults automatically.
const DATA_VERSION = 6;

const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const mealTimes = ['Breakfast', 'Lunch', 'Dinner'];

const mealTimeBadgeClass = {
  'Breakfast': 'text-bg-warning',
  'Lunch': 'text-bg-info',
  'Dinner': 'text-bg-primary'
};

const MAX_WEEK_MEALS = 7;

// Emoji shown for an ingredient when it has no image_url (or its image fails
// to load), keyed by ingredient_type so the fallback is still meaningful.
const categoryFallbackIcons = {
  'Produce': '🥬',
  'Fruit': '🍎',
  'Meat': '🥩',
  'Seafood': '🐟',
  'Dairy': '🧀',
  'Eggs': '🥚',
  'Bakery': '🍞',
  'Dry Goods': '🌾',
  'Canned Goods': '🥫',
  'Frozen': '🧊',
  'Herbs': '🌿',
  'Spices': '🧂',
  'Sauces': '🍯',
  'Condiments': '🧴',
  'Beverages': '🥤',
  'Snacks': '🍿',
  'Household': '🧻',
  'Other': '🍽'
};

// Recipes and Meals are two different things:
// - A Recipe is a single dish (its own ingredients/directions/credit) — the
//   reusable pool, managed on the Edit Recipe page.
// - A Meal (state.weekMeals) is an assembled bundle referencing one main-dish
//   Recipe plus any number of side-dish Recipes, with its own day/meal-time
//   schedule — assembled on Meal Cards, displayed on the Week Menu.
const defaultState = {
  recipes: [],
  weekMeals: [],
  masterIngredients: [],
  selectedRecipeId: '',
  selectedWeekMealId: '',
  recipeDetailReturnView: 'weekView',
  groceryList: [],
  extraGroceryItems: [],
  weekSort: 'day',
  grocerySort: 'category',
  ingredientSort: 'name'
};

let state = structuredClone(defaultState);

function normalizeName(value) {
  return (value || '').toLowerCase().trim().replace(/\s+/g, ' ');
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));
}

function getRecipeById(recipeId) {
  return state.recipes.find(item => item.recipe_id === recipeId) || null;
}

// A short display label for a Meal, used anywhere ingredients/recipes need
// to say which meal they're for (grocery list, All Ingredients "used in").
function getWeekMealLabel(weekMeal) {
  const day = weekMeal.day_of_week || '';
  const time = weekMeal.meal_time || '';
  if (day && time) return `${day} ${time}`;
  if (day) return day;
  if (time) return time;
  return 'Unscheduled Meal';
}

// Resolves a Meal's main-dish + side-dish ids into their actual Recipe
// records, quietly dropping any reference to a Recipe that no longer exists.
function getMealRecipes(weekMeal) {
  const entree = getRecipeById(weekMeal.main_recipe_id);
  const sides = weekMeal.side_recipe_ids.map(getRecipeById).filter(Boolean);
  return { entree, sides };
}

// Orders the recipe pool for a picker (main-dish select, side-dish select):
// recipes tagged for that role come first, "either" next, the rest last.
// This is only a sorting hint — every recipe still appears, so any dish can
// be picked for either role.
function sortRecipesForRole(role) {
  const priority = recipe => {
    if (recipe.dish_role === role) return 0;
    if (recipe.dish_role === 'either') return 1;
    return 2;
  };

  return [...state.recipes].sort((a, b) => priority(a) - priority(b) || a.recipe_title.localeCompare(b.recipe_title));
}

// Looks up the master ingredient record behind a recipe/grocery ingredient
// entry (by id first, falling back to a normalized-name match), so an
// ingredient image only needs to be sourced once, on the master record.
function findMasterForIngredient(ingredient) {
  if (!ingredient) return null;

  if (ingredient.ingredient_id) {
    const byId = state.masterIngredients.find(item => item.ingredient_id === ingredient.ingredient_id);
    if (byId) return byId;
  }

  const normalized = normalizeName(ingredient.ingredient_name);
  if (!normalized) return null;

  return state.masterIngredients.find(item => item.normalized_name === normalized) || null;
}

// Renders a small ingredient thumbnail (TheMealDB image_url when the master
// record has one) with an automatic emoji fallback if there's no image_url,
// or if the image fails to load (e.g. offline, or the URL 404s).
function ingredientIconMarkup(item, sizeClass) {
  const cls = sizeClass || 'ingredient-icon';
  const fallback = categoryFallbackIcons[item?.ingredient_type] || categoryFallbackIcons.Other;
  const label = escapeHtml(item?.ingredient_name || '');

  if (item?.image_url) {
    return `
      <span class="${cls}-wrap">
        <img src="${escapeHtml(item.image_url)}" alt="${label}" class="${cls}" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';" />
        <span class="${cls}-fallback" style="display:none;">${fallback}</span>
      </span>
    `;
  }

  return `<span class="${cls}-wrap"><span class="${cls}-fallback" style="display:inline-flex;">${fallback}</span></span>`;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadSavedState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return false;

  try {
    const parsed = JSON.parse(saved);

    // A saved state from an older data version is stale — discard it so
    // fresh defaults get loaded instead of resurrecting old placeholder data.
    if (parsed.dataVersion !== DATA_VERSION) {
      return false;
    }

    // Additive fields introduced after this save was written — default them
    // in rather than bumping DATA_VERSION and discarding the user's data.
    if (!Array.isArray(parsed.extraGroceryItems)) {
      parsed.extraGroceryItems = [];
    }

    state = parsed;
    return true;
  } catch (error) {
    console.error('Failed to parse saved state:', error);
    return false;
  }
}

function showLoadError() {
  const shell = document.querySelector('.app-shell');
  if (!shell || document.getElementById('loadErrorBanner')) return;

  const banner = document.createElement('div');
  banner.id = 'loadErrorBanner';
  banner.className = 'alert alert-warning';
  banner.textContent = 'Could not load starter data (data/recipes.json / data/week_meals.json / data/ingredients.json). If you opened this file directly from disk, browsers block that — run it through a local server (e.g. VS Code Live Server) or view it on GitHub Pages instead.';
  shell.prepend(banner);
}

async function loadInitialData() {
  const hasSavedState = loadSavedState();
  if (hasSavedState) return;

  try {
    const [recipesResponse, weekMealsResponse, ingredientsResponse] = await Promise.all([
      fetch('data/recipes.json'),
      fetch('data/week_meals.json'),
      fetch('data/ingredients.json')
    ]);

    if (!recipesResponse.ok || !weekMealsResponse.ok || !ingredientsResponse.ok) {
      throw new Error('One or more data files failed to load.');
    }

    const recipes = await recipesResponse.json();
    const weekMeals = await weekMealsResponse.json();
    const masterIngredients = await ingredientsResponse.json();

    state = {
      recipes,
      weekMeals,
      masterIngredients,
      selectedRecipeId: recipes[0]?.recipe_id || '',
      selectedWeekMealId: weekMeals[0]?.week_meal_id || '',
      recipeDetailReturnView: 'weekView',
      groceryList: [],
      extraGroceryItems: [],
      weekSort: 'day',
      grocerySort: 'category',
      ingredientSort: 'name',
      dataVersion: DATA_VERSION
    };

    saveState();
  } catch (error) {
    console.error('Failed to load starter data:', error);
    state = structuredClone(defaultState);
    showLoadError();
  }
}

function renderIntroInfo() {
  const versionEl = document.getElementById('introVersion');
  const countEl = document.getElementById('introRecipeCount');
  const updatedEl = document.getElementById('introLastUpdated');

  if (versionEl) versionEl.textContent = APP_VERSION;
  if (countEl) countEl.textContent = state.recipes.length;
  if (updatedEl) updatedEl.textContent = APP_LAST_UPDATED;
}

function openApp() {
  document.getElementById('introScreen').classList.add('d-none');
  document.getElementById('appShell').classList.remove('d-none');
}

function backToIntro() {
  document.getElementById('appShell').classList.add('d-none');
  document.getElementById('introScreen').classList.remove('d-none');
}

function showView(viewId) {
  document.querySelectorAll('.view-section').forEach(section => {
    section.classList.toggle('d-none', section.id !== viewId);
  });

  document.querySelectorAll('#appTabs .nav-link').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewId);
  });
}

// The Recipes page: a browsable list of the whole dish pool, sorted
// alphabetically, with View / Edit / Share actions on each card.
function renderRecipeList() {
  const grid = document.getElementById('recipeListGrid');
  if (!grid) return;

  if (!state.recipes.length) {
    grid.innerHTML = '<p class="text-muted mb-0">No recipes yet. Use "+ Add New Recipe" to create one.</p>';
    return;
  }

  const sortedRecipes = [...state.recipes].sort((a, b) => a.recipe_title.localeCompare(b.recipe_title));

  grid.innerHTML = sortedRecipes.map(recipe => `
    <div class="col-12 col-md-6">
      <div class="card recipe-card h-100">
        <div class="card-body d-flex gap-3">
          <img class="recipe-thumb" src="${escapeHtml(recipe.recipe_image || 'https://placehold.co/100x100?text=Recipe')}" alt="${escapeHtml(recipe.recipe_title)}" />

          <div class="flex-grow-1">
            <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
              <h3 class="h6 mb-0">${escapeHtml(recipe.recipe_title)}</h3>
              <span class="badge badge-soft">${escapeHtml(dishRoleLabels[recipe.dish_role] || dishRoleLabels.either)}</span>
            </div>
            <p class="text-muted small mb-2">${escapeHtml(recipe.recipe_description)}</p>

            <div class="small text-muted mb-2 d-flex align-items-center gap-2 flex-wrap">
              <span>${recipe.ingredients.length} ingredients</span>
              <span class="badge ${recipe.is_active ? 'text-bg-success' : 'text-bg-secondary'}">${recipe.is_active ? 'Active' : 'Inactive'}</span>
              ${recipe.is_favorite ? '<span class="badge badge-soft">Favorite</span>' : ''}
            </div>

            <div class="d-flex gap-2 flex-wrap">
              <button class="btn btn-sm btn-outline-dark" onclick="openRecipeDetail('${recipe.recipe_id}', 'recipeListView')">View</button>
              <button class="btn btn-sm btn-outline-primary" onclick="openRecipeEditor('${recipe.recipe_id}')">Edit</button>
              <button class="btn btn-sm btn-outline-success" onclick="exportRecipeCard('${recipe.recipe_id}')">Share</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function renderIngredientDatalist() {
  const datalist = document.getElementById('ingredientNamesList');
  if (!datalist) return;

  datalist.innerHTML = state.masterIngredients
    .map(item => `<option value="${escapeHtml(item.ingredient_name)}"></option>`)
    .join('');
}

// ISO-8601 week number for a given date (week 1 is the week containing the
// year's first Thursday). Used only for the subtle "Week NN" label.
function getISOWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

// Renders the subtle week-calendar strip above the Week Menu list: the
// current date range (Sun–Sat) and ISO week number, plus a row of day
// letters with today highlighted. Purely a display — doesn't affect data.
function renderWeekCalendar() {
  const wrap = document.getElementById('weekCalendarStrip');
  if (!wrap) return;

  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());

  const dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const dateFormat = { month: 'short', day: 'numeric' };

  const weekDates = [];
  for (let i = 0; i < 7; i += 1) {
    const d = new Date(startOfWeek);
    d.setDate(startOfWeek.getDate() + i);
    weekDates.push(d);
  }

  const pills = weekDates.map((d, i) => {
    const isToday = d.toDateString() === today.toDateString();
    return `<span class="week-day-pill ${isToday ? 'week-day-today' : ''}" title="${escapeHtml(daysOfWeek[i])}">${dayLetters[i]}</span>`;
  }).join('');

  const rangeLabel = `${weekDates[0].toLocaleDateString(undefined, dateFormat)} – ${weekDates[6].toLocaleDateString(undefined, dateFormat)}, ${weekDates[6].getFullYear()}`;

  wrap.innerHTML = `
    <div class="week-calendar-label">Week ${getISOWeekNumber(today)} · ${rangeLabel}</div>
    <div class="week-calendar-days">${pills}</div>
  `;
}

// Orders the current-week Meals per the chosen "simple sort" mode. Unassigned
// days/meal-times sort to the end rather than the beginning. "Title" sorts by
// the Meal's main-dish recipe title, since a Meal has no title of its own.
function sortWeekMeals(weekMeals) {
  const mode = state.weekSort || 'day';
  const sorted = [...weekMeals];

  const dayIndex = wm => (wm.day_of_week ? daysOfWeek.indexOf(wm.day_of_week) : daysOfWeek.length);
  const timeIndex = wm => (wm.meal_time ? mealTimes.indexOf(wm.meal_time) : mealTimes.length);
  const titleOf = wm => getRecipeById(wm.main_recipe_id)?.recipe_title || '';

  if (mode === 'mealtime') {
    sorted.sort((a, b) => timeIndex(a) - timeIndex(b) || titleOf(a).localeCompare(titleOf(b)));
  } else if (mode === 'title') {
    sorted.sort((a, b) => titleOf(a).localeCompare(titleOf(b)));
  } else {
    sorted.sort((a, b) => dayIndex(a) - dayIndex(b) || timeIndex(a) - timeIndex(b) || titleOf(a).localeCompare(titleOf(b)));
  }

  return sorted;
}

// Quick-edit from Meal Cards — sets a Meal's day and/or meal time without
// needing a separate form. Refreshes both Meal Cards (where the controls
// live) and Week Menu (which displays them as read-only badges).
function updateMealSchedule(weekMealId, field, value) {
  if (field !== 'day_of_week' && field !== 'meal_time') return;

  const weekMeal = state.weekMeals.find(item => item.week_meal_id === weekMealId);
  if (!weekMeal) return;

  weekMeal[field] = value;
  saveState();
  renderMealCards();
  renderWeekMeals();
}

function renderWeekMeals() {
  const currentWeekMeals = sortWeekMeals(state.weekMeals.filter(wm => wm.is_current_week)).slice(0, MAX_WEEK_MEALS);
  const grid = document.getElementById('weekMealsGrid');
  const count = document.getElementById('weekMealCount');
  count.textContent = `${currentWeekMeals.length} / ${MAX_WEEK_MEALS} meals`;

  const sortSelect = document.getElementById('weekSortSelect');
  if (sortSelect) sortSelect.value = state.weekSort || 'day';

  if (!currentWeekMeals.length) {
    grid.innerHTML = '<p class="text-muted mb-0">No meals added to this week yet. Add some from Meal Cards.</p>';
    return;
  }

  grid.innerHTML = currentWeekMeals.map(weekMeal => {
    const { entree, sides } = getMealRecipes(weekMeal);
    const title = entree ? entree.recipe_title : 'No main dish selected';
    const description = entree ? entree.recipe_description : 'Assign a main dish for this meal from Meal Cards.';
    const image = entree?.recipe_image || 'https://placehold.co/100x100?text=Meal';
    const icons = entree?.recipe_icons || [];
    const isActive = Boolean(entree?.is_active);
    const isFavorite = Boolean(entree?.is_favorite);

    return `
      <div class="col-12 col-md-6">
        <div class="card meal-card h-100 entry-clickable" onclick="openMealSummary('${weekMeal.week_meal_id}')">
          <div class="card-body">
            <div class="entry-top-row">
              <img class="meal-thumb" src="${escapeHtml(image)}" alt="${escapeHtml(title)}" />

              <div class="d-flex flex-wrap gap-2 align-items-center">
                <div class="d-flex gap-1 fs-5">
                  ${icons.map(icon => `<span>${escapeHtml(icon)}</span>`).join('')}
                </div>

                <span class="badge ${isActive ? 'text-bg-success' : 'text-bg-secondary'}">
                  ${isActive ? 'Active' : 'Inactive'}
                </span>

                ${isFavorite ? '<span class="badge badge-soft">Favorite</span>' : ''}
                ${weekMeal.meal_time ? `<span class="badge ${mealTimeBadgeClass[weekMeal.meal_time] || 'text-bg-light'}">${escapeHtml(weekMeal.meal_time)}</span>` : ''}
                ${weekMeal.day_of_week ? `<span class="badge text-bg-light">${escapeHtml(weekMeal.day_of_week)}</span>` : ''}
              </div>
            </div>

            <div class="entry-bottom-row">
              <div>
                <h3 class="h6 mb-1">${escapeHtml(title)}</h3>
                <p class="text-muted small mb-0">${escapeHtml(description)}</p>
                ${sides.length ? `<p class="week-sides-line mb-0">Sides: ${sides.map(side => escapeHtml(side.recipe_title)).join(', ')}</p>` : ''}
              </div>

              <button class="btn btn-sm btn-outline-dark entry-view-btn" onclick="event.stopPropagation(); openMealSummary('${weekMeal.week_meal_id}')">
                View
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// The Meal Cards page: one card per assembled Meal, with always-editable
// selects for the main dish, chips + a select to add/remove side dishes,
// the day/meal-time quick-schedule controls, and week-membership actions.
function renderMealCards() {
  const grid = document.getElementById('mealCardsGrid');
  if (!grid) return;

  if (!state.weekMeals.length) {
    grid.innerHTML = '<p class="text-muted mb-0">No meals yet. Use "Add Meal" to assemble one from your recipe pool.</p>';
    return;
  }

  grid.innerHTML = state.weekMeals.map(weekMeal => {
    const usedIds = new Set([weekMeal.main_recipe_id, ...weekMeal.side_recipe_ids].filter(Boolean));
    const mainOptions = sortRecipesForRole('main');
    const sideOptions = sortRecipesForRole('side').filter(recipe => !usedIds.has(recipe.recipe_id));
    const entree = getRecipeById(weekMeal.main_recipe_id);

    return `
      <div class="col-12 col-md-6" id="meal-card-${weekMeal.week_meal_id}">
        <div class="card recipe-card h-100">
          <div class="card-body d-flex gap-3">
            <img class="recipe-thumb" src="${escapeHtml(entree?.recipe_image || 'https://placehold.co/100x100?text=Meal')}" alt="${escapeHtml(entree?.recipe_title || 'Meal')}" />

            <div class="flex-grow-1">
              <div class="tiny-label mb-1">Main Dish</div>
              <select class="form-select form-select-sm mb-2" aria-label="Main dish" onchange="setMealMainRecipe('${weekMeal.week_meal_id}', this.value)">
                <option value="">Choose main dish…</option>
                ${mainOptions.map(recipe => `<option value="${recipe.recipe_id}" ${weekMeal.main_recipe_id === recipe.recipe_id ? 'selected' : ''}>${escapeHtml(recipe.recipe_title)}</option>`).join('')}
              </select>

              <div class="tiny-label mb-1">Side Dishes</div>
              <div class="d-flex flex-wrap gap-2 align-items-center mb-2">
                ${weekMeal.side_recipe_ids.map(sideId => {
                  const sideRecipe = getRecipeById(sideId);
                  if (!sideRecipe) return '';
                  return `
                    <span class="side-chip">
                      ${escapeHtml(sideRecipe.recipe_title)}
                      <button type="button" class="side-chip-remove" title="Remove side" onclick="removeMealSide('${weekMeal.week_meal_id}', '${sideId}')">×</button>
                    </span>
                  `;
                }).join('')}

                <select class="form-select form-select-sm side-add-select" aria-label="Add a side dish" onchange="addMealSide('${weekMeal.week_meal_id}', this.value); this.value='';">
                  <option value="">+ Add Side…</option>
                  ${sideOptions.map(recipe => `<option value="${recipe.recipe_id}">${escapeHtml(recipe.recipe_title)}</option>`).join('')}
                </select>
              </div>

              <div class="d-flex flex-wrap gap-2 mb-2 week-schedule-controls">
                <select class="form-select form-select-sm" aria-label="Day for this meal" onchange="updateMealSchedule('${weekMeal.week_meal_id}', 'day_of_week', this.value)">
                  <option value="">Day…</option>
                  ${daysOfWeek.map(day => `<option value="${day}" ${weekMeal.day_of_week === day ? 'selected' : ''}>${day}</option>`).join('')}
                </select>
                <select class="form-select form-select-sm" aria-label="Meal time for this meal" onchange="updateMealSchedule('${weekMeal.week_meal_id}', 'meal_time', this.value)">
                  <option value="">Meal…</option>
                  ${mealTimes.map(time => `<option value="${time}" ${weekMeal.meal_time === time ? 'selected' : ''}>${time}</option>`).join('')}
                </select>
              </div>

              <div class="d-flex gap-2 flex-wrap">
                <button class="btn btn-sm btn-outline-dark" onclick="openMealSummary('${weekMeal.week_meal_id}')">View</button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteWeekMeal('${weekMeal.week_meal_id}')">Delete</button>
                <button class="btn btn-sm ${weekMeal.is_current_week ? 'btn-success' : 'btn-outline-success'}" onclick="toggleCurrentWeek('${weekMeal.week_meal_id}')">
                  ${weekMeal.is_current_week ? 'In Week' : 'Add to Week'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function setMealMainRecipe(weekMealId, recipeId) {
  const weekMeal = state.weekMeals.find(item => item.week_meal_id === weekMealId);
  if (!weekMeal) return;

  weekMeal.main_recipe_id = recipeId;
  // A recipe can't be both the main dish and a side on the same meal.
  weekMeal.side_recipe_ids = weekMeal.side_recipe_ids.filter(id => id !== recipeId);

  saveState();
  renderMealCards();
  renderWeekMeals();
  generateGroceryList();
}

function addMealSide(weekMealId, recipeId) {
  if (!recipeId) return;

  const weekMeal = state.weekMeals.find(item => item.week_meal_id === weekMealId);
  if (!weekMeal || recipeId === weekMeal.main_recipe_id || weekMeal.side_recipe_ids.includes(recipeId)) return;

  weekMeal.side_recipe_ids.push(recipeId);
  saveState();
  renderMealCards();
  renderWeekMeals();
  generateGroceryList();
}

function removeMealSide(weekMealId, recipeId) {
  const weekMeal = state.weekMeals.find(item => item.week_meal_id === weekMealId);
  if (!weekMeal) return;

  weekMeal.side_recipe_ids = weekMeal.side_recipe_ids.filter(id => id !== recipeId);
  saveState();
  renderMealCards();
  renderWeekMeals();
  generateGroceryList();
}

function deleteWeekMeal(weekMealId) {
  const weekMeal = state.weekMeals.find(item => item.week_meal_id === weekMealId);
  if (!weekMeal) return;

  const label = getRecipeById(weekMeal.main_recipe_id)?.recipe_title || 'this meal';
  if (!confirm(`Remove "${label}" from your meals? This only removes the assembled meal — the underlying recipes stay in your recipe pool.`)) return;

  state.weekMeals = state.weekMeals.filter(item => item.week_meal_id !== weekMealId);
  saveState();
  renderWeekMeals();
  renderMealCards();
  generateGroceryList();
}

function createNewWeekMeal() {
  const newWeekMeal = {
    week_meal_id: `wm_${Date.now()}`,
    day_of_week: '',
    meal_time: '',
    main_recipe_id: '',
    side_recipe_ids: [],
    is_current_week: false
  };

  state.weekMeals.push(newWeekMeal);
  saveState();
  renderMealCards();
  showView('mealCardsView');

  requestAnimationFrame(() => {
    document.getElementById(`meal-card-${newWeekMeal.week_meal_id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}

function toggleCurrentWeek(weekMealId) {
  const weekMeal = state.weekMeals.find(item => item.week_meal_id === weekMealId);
  if (!weekMeal) return;

  if (!weekMeal.is_current_week) {
    if (!weekMeal.main_recipe_id) {
      alert('Choose a main dish for this meal before adding it to the week.');
      return;
    }

    const currentWeekMeals = state.weekMeals.filter(item => item.is_current_week);
    if (currentWeekMeals.length >= MAX_WEEK_MEALS) {
      alert(`Maximum of ${MAX_WEEK_MEALS} meals for the week (one per day).`);
      return;
    }
  }

  weekMeal.is_current_week = !weekMeal.is_current_week;

  // A day assignment only means something while the meal is in the current
  // week — clear it on removal so it doesn't carry stale info if re-added.
  if (!weekMeal.is_current_week) {
    weekMeal.day_of_week = '';
  }

  saveState();
  renderWeekMeals();
  renderMealCards();
  generateGroceryList();
}

function openMealSummary(weekMealId) {
  state.selectedWeekMealId = weekMealId;
  saveState();
  renderMealSummary();
  showView('mealSummaryView');
}

// The Meal Summary view: a lightweight list of the main dish and each side
// dish (name/thumbnail only) — clicking any row opens that single recipe's
// own full detail page (ingredients/directions/credit).
function renderMealSummary() {
  const wrapper = document.getElementById('mealSummaryContent');
  if (!wrapper) return;

  const weekMeal = state.weekMeals.find(item => item.week_meal_id === state.selectedWeekMealId);
  if (!weekMeal) {
    wrapper.innerHTML = '<p class="text-muted mb-0">No meal selected.</p>';
    return;
  }

  const { entree, sides } = getMealRecipes(weekMeal);
  const label = getWeekMealLabel(weekMeal);

  const rowHtml = (recipe, roleLabel) => `
    <div class="meal-summary-row mb-2" onclick="openRecipeDetail('${recipe.recipe_id}', 'mealSummaryView')">
      <img class="meal-summary-thumb" src="${escapeHtml(recipe.recipe_image || 'https://placehold.co/100x100?text=Recipe')}" alt="${escapeHtml(recipe.recipe_title)}" />
      <div class="flex-grow-1">
        <div class="tiny-label mb-1">${escapeHtml(roleLabel)}</div>
        <div class="fw-semibold">${escapeHtml(recipe.recipe_title)}</div>
        <div class="small text-muted">${escapeHtml(recipe.recipe_description)}</div>
      </div>
      <span class="text-muted">›</span>
    </div>
  `;

  wrapper.innerHTML = `
    <div class="d-flex justify-content-between align-items-start flex-wrap gap-2 mb-3">
      <div>
        <h2 class="h4 mb-1">${escapeHtml(label)}</h2>
        <p class="text-muted mb-0">${sides.length ? `Main dish plus ${sides.length} side${sides.length === 1 ? '' : 's'}` : 'Main dish, no sides'}</p>
      </div>
      <button class="btn btn-sm btn-outline-primary" onclick="showView('mealCardsView')">Edit This Meal</button>
    </div>

    ${entree ? rowHtml(entree, 'Main Dish') : '<p class="text-muted">No main dish assigned yet.</p>'}

    ${sides.length ? `
      <div class="tiny-label mt-3 mb-2">Side Dishes</div>
      ${sides.map(side => rowHtml(side, 'Side Dish')).join('')}
    ` : ''}
  `;
}

// Opens a single recipe's full detail page. returnView tells the Back
// button which page to return to (Meal Summary or Edit Recipe).
function openRecipeDetail(recipeId, returnView) {
  state.selectedRecipeId = recipeId;
  state.recipeDetailReturnView = returnView || 'weekView';
  saveState();
  renderRecipeDetail();
  showView('recipeDetailView');
}

const dishRoleLabels = {
  main: 'Main Dish',
  side: 'Side Dish',
  either: 'Main or Side'
};

function renderRecipeDetail() {
  const recipe = getRecipeById(state.selectedRecipeId);
  const wrapper = document.getElementById('recipeDetailContent');

  if (!wrapper) return;

  if (!recipe) {
    wrapper.innerHTML = '<p class="text-muted mb-0">No recipe selected.</p>';
    return;
  }

  const directions = recipe.directions || [];
  const credit = recipe.credit || {
    created_by: 'Unknown',
    shared_by: 'Pangea Grocery List (PGL)',
    source: 'Family Recipe',
    date_added: '2026'
  };
  const roleLabel = dishRoleLabels[recipe.dish_role] || dishRoleLabels.either;

  wrapper.innerHTML = `
    <div class="recipe-detail-header mb-4">
      <img class="recipe-hero-img mb-3" src="${escapeHtml(recipe.recipe_image || 'https://placehold.co/900x400?text=Recipe')}" alt="${escapeHtml(recipe.recipe_title)}" />

      <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
        <div>
          <div class="d-flex align-items-center gap-2 mb-1 flex-wrap">
            <h2 class="h3 mb-0">${escapeHtml(recipe.recipe_title)}</h2>
            <span class="badge badge-soft">${escapeHtml(roleLabel)}</span>
          </div>
          <p class="text-muted mb-2">${escapeHtml(recipe.recipe_description)}</p>

          <div class="d-flex gap-2 fs-3 mb-3">
            ${(recipe.recipe_icons || []).map(icon => `<span>${escapeHtml(icon)}</span>`).join('')}
          </div>
        </div>

        <button class="btn btn-outline-primary" onclick="openRecipeEditor('${recipe.recipe_id}')">
          Edit Recipe
        </button>
      </div>
    </div>

    <div class="card section-card mb-3">
      <div class="card-body">
        <h3 class="h5 mb-3">01 — Ingredients</h3>

        ${recipe.ingredients.length ? `
          <ul class="list-group">
            ${recipe.ingredients.map(ingredient => {
              const master = findMasterForIngredient(ingredient);
              return `
                <li class="list-group-item d-flex justify-content-between align-items-center gap-2">
                  <span class="d-flex align-items-center gap-2">
                    ${ingredientIconMarkup(master || ingredient, 'row-icon')}
                    ${escapeHtml(ingredient.ingredient_name)}
                  </span>
                  <span class="text-muted">
                    ${ingredient.quantity_value} ${escapeHtml(ingredient.quantity_unit)}
                  </span>
                </li>
              `;
            }).join('')}
          </ul>
        ` : '<p class="text-muted mb-0">No ingredients added yet.</p>'}
      </div>
    </div>

    <div class="card section-card mb-3">
      <div class="card-body">
        <h3 class="h5 mb-3">02 — Directions</h3>

        ${directions.length ? `
          <div class="accordion" id="directionsAccordion">
            ${directions.map((step, index) => `
              <div class="accordion-item">
                <h2 class="accordion-header" id="heading_${step.step_id}">
                  <button
                    class="accordion-button ${index === 0 ? '' : 'collapsed'}"
                    type="button"
                    data-bs-toggle="collapse"
                    data-bs-target="#collapse_${step.step_id}"
                    aria-expanded="${index === 0 ? 'true' : 'false'}"
                    aria-controls="collapse_${step.step_id}"
                  >
                    ${index + 1}. ${escapeHtml(step.step_title)}
                  </button>
                </h2>

                <div
                  id="collapse_${step.step_id}"
                  class="accordion-collapse collapse ${index === 0 ? 'show' : ''}"
                  aria-labelledby="heading_${step.step_id}"
                  data-bs-parent="#directionsAccordion"
                >
                  <div class="accordion-body">
                    ${step.step_image ? `<img class="direction-img mb-3" src="${escapeHtml(step.step_image)}" alt="${escapeHtml(step.step_title)}" />` : ''}
                    <p class="mb-0">${escapeHtml(step.step_text)}</p>
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : '<p class="text-muted mb-0">No directions added yet.</p>'}
      </div>
    </div>

    <div class="card section-card">
      <div class="card-body">
        <h3 class="h5 mb-3">03 — Credit</h3>

        <div class="small text-muted">
          <div><strong>Created By:</strong> ${escapeHtml(credit.created_by)}</div>
          <div><strong>Shared By:</strong> ${escapeHtml(credit.shared_by)}</div>
          <div><strong>Source:</strong> ${escapeHtml(credit.source)}</div>
          <div><strong>Date Added:</strong> ${escapeHtml(credit.date_added)}</div>
        </div>
      </div>
    </div>
  `;
}

function ingredientSuggestions(inputValue) {
  const normalized = normalizeName(inputValue);
  if (!normalized) return [];

  return state.masterIngredients.filter(item =>
    item.normalized_name.includes(normalized)
  ).slice(0, 5);
}

function renderRecipeEditor() {
  const recipe = getRecipeById(state.selectedRecipeId);
  const form = document.getElementById('recipeForm');

  if (!recipe) {
    if (form) form.classList.add('d-none');
    return;
  }

  if (form) form.classList.remove('d-none');

  document.getElementById('recipeTitle').value = recipe.recipe_title;
  document.getElementById('recipeDescription').value = recipe.recipe_description;
  document.getElementById('recipePreview').src = recipe.recipe_image || 'https://placehold.co/100x100?text=Recipe';
  document.getElementById('recipeFavorite').checked = recipe.is_favorite;
  document.getElementById('recipeActive').checked = recipe.is_active;
  document.getElementById('dishRoleSelect').value = recipe.dish_role || 'either';

  renderIngredientEditorRows();
}

// Rebuilds only the ingredient rows, without touching the title/description/toggle
// fields above them — so adding or removing a row never discards an in-progress,
// not-yet-saved edit to the rest of the form.
function renderIngredientEditorRows() {
  const recipe = getRecipeById(state.selectedRecipeId);
  const list = document.getElementById('ingredientEditorList');
  if (!recipe || !list) return;

  if (!recipe.ingredients.length) {
    list.innerHTML = '<p class="text-muted mb-0">No ingredients yet. Click "Add Ingredient" to start.</p>';
    return;
  }

  list.innerHTML = recipe.ingredients.map((ingredient, index) => {
    const normalized = normalizeName(ingredient.ingredient_name);
    const master = findMasterForIngredient(ingredient);
    const hasExactMatch = !normalized || Boolean(master);
    const suggestions = hasExactMatch ? [] : ingredientSuggestions(ingredient.ingredient_name);

    let hintHtml = '';
    if (!hasExactMatch) {
      hintHtml = suggestions.length
        ? `<div class="small text-muted mt-1">Did you mean: ${suggestions.map(s => escapeHtml(s.ingredient_name)).join(', ')}?</div>`
        : `<div class="small text-warning mt-1">New ingredient — will be added to your ingredient library when you save.</div>`;
    }

    return `
      <div class="ingredient-row py-3">
        <div class="d-flex justify-content-end">
          <button type="button" class="btn btn-sm btn-link text-danger p-0 remove-ingredient-btn" data-index="${index}">Remove</button>
        </div>
        <div class="row g-2 align-items-end">
          <div class="col-12 col-md-4">
            <label class="form-label d-flex align-items-center gap-2">
              ${ingredientIconMarkup(master || ingredient, 'row-icon')}
              <span>Ingredient</span>
            </label>
            <input class="form-control ingredient-name" data-index="${index}" list="ingredientNamesList" value="${escapeHtml(ingredient.ingredient_name)}" />
            ${hintHtml}
          </div>
          <div class="col-4 col-md-2">
            <label class="form-label">Qty</label>
            <input class="form-control ingredient-qty" data-index="${index}" type="number" min="0" step="0.25" value="${ingredient.quantity_value}" />
          </div>
          <div class="col-4 col-md-2">
            <label class="form-label">Unit</label>
            <input class="form-control ingredient-unit" data-index="${index}" value="${escapeHtml(ingredient.quantity_unit)}" />
          </div>
          <div class="col-4 col-md-2">
            <label class="form-label">Type</label>
            <select class="form-select ingredient-type" data-index="${index}">
              ${ingredientTypes.map(type => `<option value="${type}" ${ingredient.ingredient_type === type ? 'selected' : ''}>${type}</option>`).join('')}
            </select>
          </div>
          <div class="col-12 col-md-2">
            <label class="form-label">Store</label>
            <select class="form-select ingredient-store" data-index="${index}">
              ${stores.map(store => `<option value="${store}" ${ingredient.store_name === store ? 'selected' : ''}>${store}</option>`).join('')}
            </select>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

function openRecipeEditor(recipeId) {
  state.selectedRecipeId = recipeId;
  saveState();
  renderRecipeEditor();
  showView('editView');
}

function createNewRecipe() {
  const newRecipe = {
    recipe_id: `recipe_${Date.now()}`,
    recipe_title: 'New Recipe',
    recipe_description: '',
    recipe_image: 'https://placehold.co/900x400?text=New+Recipe',
    is_active: true,
    is_favorite: false,
    dish_role: 'either',
    recipe_icons: ['🍽', '❓', '❓'],
    ingredients: [],
    directions: [],
    credit: {
      created_by: 'You',
      shared_by: 'Pangea Grocery List (PGL)',
      source: 'Home Kitchen',
      date_added: String(new Date().getFullYear())
    }
  };

  state.recipes.push(newRecipe);
  state.selectedRecipeId = newRecipe.recipe_id;

  saveState();
  renderRecipeList();
  renderRecipeEditor();
  renderMealCards();
  showView('editView');

  const titleField = document.getElementById('recipeTitle');
  if (titleField) {
    titleField.focus();
    titleField.select();
  }
}

// Reads the ingredient rows currently on screen (including anything the user
// has typed but not saved yet) back into row objects, so add/remove actions
// don't clobber in-progress edits to the other rows. Returns null if the
// ingredient form isn't rendered (e.g. no rows yet).
function captureIngredientRowsFromForm(recipe) {
  const nameInputs = [...document.querySelectorAll('.ingredient-name')];
  if (!nameInputs.length) return null;

  const qtyInputs = [...document.querySelectorAll('.ingredient-qty')];
  const unitInputs = [...document.querySelectorAll('.ingredient-unit')];
  const typeInputs = [...document.querySelectorAll('.ingredient-type')];
  const storeInputs = [...document.querySelectorAll('.ingredient-store')];

  return nameInputs.map((input, index) => ({
    recipe_ingredient_entry_id: recipe.ingredients[index]?.recipe_ingredient_entry_id || `entry_${Date.now()}_${index}`,
    ingredient_id: recipe.ingredients[index]?.ingredient_id || '',
    ingredient_name: input.value,
    ingredient_type: typeInputs[index]?.value || 'Other',
    quantity_value: Number(qtyInputs[index]?.value) || 1,
    quantity_unit: unitInputs[index]?.value || 'count',
    store_name: storeInputs[index]?.value || 'Walmart'
  }));
}

function addIngredientToSelectedRecipe() {
  const recipe = getRecipeById(state.selectedRecipeId);
  if (!recipe) return;

  const capturedRows = captureIngredientRowsFromForm(recipe);
  if (capturedRows) recipe.ingredients = capturedRows;

  recipe.ingredients.push({
    recipe_ingredient_entry_id: `entry_${Date.now()}`,
    ingredient_id: '',
    ingredient_name: '',
    ingredient_type: 'Other',
    quantity_value: 1,
    quantity_unit: 'count',
    store_name: 'Walmart'
  });

  saveState();
  renderIngredientEditorRows();
}

function removeIngredientFromSelectedRecipe(index) {
  const recipe = getRecipeById(state.selectedRecipeId);
  if (!recipe) return;

  const capturedRows = captureIngredientRowsFromForm(recipe);
  if (capturedRows) recipe.ingredients = capturedRows;

  recipe.ingredients.splice(index, 1);

  saveState();
  renderIngredientEditorRows();
}

function saveSelectedRecipe(event) {
  event.preventDefault();

  const recipe = getRecipeById(state.selectedRecipeId);
  if (!recipe) return;

  const titleValue = document.getElementById('recipeTitle').value.trim();
  if (!titleValue) {
    alert('Please enter a recipe title before saving.');
    return;
  }

  const nameInputs = [...document.querySelectorAll('.ingredient-name')];
  const qtyInputs = [...document.querySelectorAll('.ingredient-qty')];
  const unitInputs = [...document.querySelectorAll('.ingredient-unit')];
  const typeInputs = [...document.querySelectorAll('.ingredient-type')];
  const storeInputs = [...document.querySelectorAll('.ingredient-store')];

  const rows = nameInputs
    .map((input, index) => ({
      name: input.value.trim(),
      qty: Number(qtyInputs[index].value) || 1,
      unit: unitInputs[index].value.trim() || 'count',
      type: typeInputs[index].value,
      store: storeInputs[index].value
    }))
    .filter(row => row.name);

  // Find ingredient names typed that don't match anything in the master list yet.
  const newRows = [];
  rows.forEach(row => {
    const normalized = normalizeName(row.name);
    const existsInMaster = state.masterIngredients.some(item => item.normalized_name === normalized);
    const alreadyQueued = newRows.some(item => normalizeName(item.name) === normalized);

    if (!existsInMaster && !alreadyQueued) {
      newRows.push(row);
    }
  });

  if (newRows.length) {
    const names = newRows.map(row => row.name).join(', ');
    const label = newRows.length === 1 ? 'this ingredient' : 'these ingredients';
    const confirmed = confirm(
      `No matching ingredient found for: ${names}\n\nCreate ${label} in your ingredient library and save this recipe?`
    );

    if (!confirmed) return;

    newRows.forEach(row => {
      state.masterIngredients.push({
        ingredient_id: `ing_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        ingredient_name: row.name,
        normalized_name: normalizeName(row.name),
        ingredient_type: row.type,
        default_unit: row.unit,
        default_store: row.store
      });
    });
  }

  recipe.recipe_title = titleValue;
  recipe.recipe_description = document.getElementById('recipeDescription').value.trim();
  recipe.is_favorite = document.getElementById('recipeFavorite').checked;
  recipe.is_active = document.getElementById('recipeActive').checked;
  recipe.dish_role = document.getElementById('dishRoleSelect').value;

  recipe.ingredients = rows.map(row => {
    const normalized = normalizeName(row.name);
    const master = state.masterIngredients.find(item => item.normalized_name === normalized);
    const existingEntry = recipe.ingredients.find(entry =>
      normalizeName(entry.ingredient_name) === normalized && entry.quantity_unit === row.unit
    );

    return {
      recipe_ingredient_entry_id: existingEntry?.recipe_ingredient_entry_id || `entry_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      ingredient_id: master ? master.ingredient_id : '',
      ingredient_name: row.name,
      ingredient_type: row.type,
      quantity_value: row.qty,
      quantity_unit: row.unit,
      store_name: row.store
    };
  });

  saveState();
  renderWeekMeals();
  renderMealCards();
  renderRecipeList();
  renderRecipeEditor();
  renderRecipeDetail();
  renderIngredientDatalist();
  generateGroceryList();
  renderAllIngredients();

  alert(newRows.length
    ? `Recipe saved. Added ${newRows.length} new ingredient${newRows.length === 1 ? '' : 's'} to your ingredient library.`
    : 'Recipe saved.');
}

function generateGroceryList() {
  const currentWeekMeals = state.weekMeals.filter(weekMeal => weekMeal.is_current_week);
  const previousChecked = new Map(state.groceryList.map(item => [item.key, item.checked]));
  const merged = new Map();

  currentWeekMeals.forEach(weekMeal => {
    const { entree, sides } = getMealRecipes(weekMeal);
    const mealLabel = getWeekMealLabel(weekMeal);
    const recipesInMeal = [entree, ...sides].filter(Boolean);

    recipesInMeal.forEach(recipe => {
      recipe.ingredients.forEach(ingredient => {
        const key = `${normalizeName(ingredient.ingredient_name)}__${ingredient.quantity_unit}__${ingredient.store_name}`;

        if (!merged.has(key)) {
          const master = findMasterForIngredient(ingredient);

          merged.set(key, {
            key,
            ingredient_name: ingredient.ingredient_name,
            ingredient_type: ingredient.ingredient_type,
            image_url: master?.image_url || '',
            total_quantity_value: Number(ingredient.quantity_value) || 0,
            quantity_unit: ingredient.quantity_unit,
            store_name: ingredient.store_name,
            meals: [mealLabel],
            checked: previousChecked.get(key) || false
          });
        } else {
          const existing = merged.get(key);
          existing.total_quantity_value += Number(ingredient.quantity_value) || 0;

          if (!existing.meals.includes(mealLabel)) {
            existing.meals.push(mealLabel);
          }
        }
      });
    });
  });

  state.groceryList = [...merged.values()];
  saveState();
  renderGroceryList();
}

// Orders a set of grocery items alphabetically by ingredient name — used both
// for the flat "Name" sort mode and to order items inside each group.
function sortGroceryItems(items) {
  return [...items].sort((a, b) => a.ingredient_name.localeCompare(b.ingredient_name));
}

// Renders one grocery-list row, including the "A, B, total C" line showing
// which meal(s) an item is for and its combined total amount.
function groceryItemRowHtml(item) {
  const mealsLabel = item.meals.map(escapeHtml).join(', ');

  return `
    <li class="list-group-item">
      <div class="form-check d-flex align-items-start gap-2">
        <input class="form-check-input grocery-check mt-1" type="checkbox" data-key="${escapeHtml(item.key)}" ${item.checked ? 'checked' : ''} />
        ${ingredientIconMarkup(item, 'grocery-icon')}
        <label class="form-check-label w-100 ${item.checked ? 'text-decoration-line-through text-muted' : ''}">
          <div class="d-flex justify-content-between gap-2">
            <strong>${escapeHtml(item.ingredient_name)}</strong>
            <span>${item.total_quantity_value} ${escapeHtml(item.quantity_unit)}</span>
          </div>

          <div class="small text-muted">
            ${mealsLabel}, total ${item.total_quantity_value} ${escapeHtml(item.quantity_unit)}
          </div>

          <div class="small text-muted">Store: ${escapeHtml(item.store_name)}</div>
        </label>
      </div>
    </li>
  `;
}

function renderGroceryList() {
  const wrapper = document.getElementById('groceryGroups');
  const sortSelect = document.getElementById('grocerySortSelect');
  if (sortSelect) sortSelect.value = state.grocerySort || 'category';

  if (!state.groceryList.length) {
    wrapper.innerHTML = '<p class="text-muted mb-0">No grocery items yet. Add meals to your current week first.</p>';
    return;
  }

  const mode = state.grocerySort || 'category';

  if (mode === 'name') {
    wrapper.innerHTML = `
      <ul class="list-group">
        ${sortGroceryItems(state.groceryList).map(groceryItemRowHtml).join('')}
      </ul>
    `;
    return;
  }

  const groupField = mode === 'store' ? 'store_name' : 'ingredient_type';

  const grouped = state.groceryList.reduce((acc, item) => {
    const key = item[groupField];
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});

  wrapper.innerHTML = Object.entries(grouped)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([group, items]) => `
      <div class="mb-4">
        <div class="tiny-label mb-2">${escapeHtml(group)}</div>
        <ul class="list-group">
          ${sortGroceryItems(items).map(groceryItemRowHtml).join('')}
        </ul>
      </div>
    `).join('');
}

// "Other Items" — a second, separate list on the Grocery List page for
// anything that isn't tied to a recipe's ingredients (soap, paper towels,
// etc.). Lives in its own state array so generateGroceryList() (which
// rebuilds state.groceryList from the current week's meals) never touches it.
function renderExtraGroceryItems() {
  const wrapper = document.getElementById('extraItemsList');
  if (!wrapper) return;

  const items = state.extraGroceryItems || [];

  if (!items.length) {
    wrapper.innerHTML = '<p class="text-muted small mb-0">No extra items added yet.</p>';
    return;
  }

  wrapper.innerHTML = `
    <ul class="list-group">
      ${items.map(item => `
        <li class="list-group-item d-flex align-items-center gap-2">
          <input class="form-check-input extra-item-check" type="checkbox" data-id="${escapeHtml(item.extra_item_id)}" ${item.checked ? 'checked' : ''} />
          <span class="flex-grow-1 ${item.checked ? 'text-decoration-line-through text-muted' : ''}">${escapeHtml(item.item_name)}</span>
          <button type="button" class="btn btn-sm btn-link text-danger p-0 remove-extra-item-btn" data-id="${escapeHtml(item.extra_item_id)}">Remove</button>
        </li>
      `).join('')}
    </ul>
  `;
}

function addExtraGroceryItem(name) {
  const trimmed = (name || '').trim();
  if (!trimmed) return;

  if (!Array.isArray(state.extraGroceryItems)) state.extraGroceryItems = [];

  state.extraGroceryItems.push({
    extra_item_id: `extra_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    item_name: trimmed,
    checked: false
  });

  saveState();
  renderExtraGroceryItems();
}

function removeExtraGroceryItem(extraItemId) {
  state.extraGroceryItems = (state.extraGroceryItems || []).filter(item => item.extra_item_id !== extraItemId);
  saveState();
  renderExtraGroceryItems();
}

// Formats the current grocery list (plus any "Other Items") as readable
// plain text and copies it to the clipboard (with a prompt() fallback),
// mirroring exportRecipeCard().
function shareGroceryList() {
  const extraItems = state.extraGroceryItems || [];

  if (!state.groceryList.length && !extraItems.length) {
    alert('Your grocery list is empty. Generate it first from the Week Menu, or add an item below.');
    return;
  }

  const lines = ['Pangea Grocery List (PGL) — Weekly Grocery List', ''];

  if (state.groceryList.length) {
    const grouped = state.groceryList.reduce((acc, item) => {
      if (!acc[item.ingredient_type]) acc[item.ingredient_type] = [];
      acc[item.ingredient_type].push(item);
      return acc;
    }, {});

    Object.entries(grouped).forEach(([group, items]) => {
      lines.push(`${group}:`);
      sortGroceryItems(items).forEach(item => {
        const mealsLabel = item.meals.join(', ');
        const checkedMark = item.checked ? ' [x]' : '';
        lines.push(`  - ${item.ingredient_name} — ${mealsLabel}, total ${item.total_quantity_value} ${item.quantity_unit} · ${item.store_name}${checkedMark}`);
      });
      lines.push('');
    });
  }

  if (extraItems.length) {
    lines.push('Other Items:');
    extraItems.forEach(item => {
      const checkedMark = item.checked ? ' [x]' : '';
      lines.push(`  - ${item.item_name}${checkedMark}`);
    });
    lines.push('');
  }

  const listText = lines.join('\n').trim();

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(listText)
      .then(() => alert('Grocery list copied to clipboard.'))
      .catch(() => {
        prompt('Copy this grocery list:', listText);
      });
  } else {
    prompt('Copy this grocery list:', listText);
  }
}

// Returns the unique list of Meal labels (e.g. "Sunday Dinner") whose main
// dish or side dishes reference the given master ingredient — matched by
// ingredient_id first, falling back to a normalized-name match. Powers the
// "origin of recipe" info on the All Ingredients page.
function getMealsUsingIngredient(ingredient) {
  if (!ingredient) return [];

  const normalized = normalizeName(ingredient.ingredient_name);
  const labels = [];

  state.weekMeals.forEach(weekMeal => {
    const { entree, sides } = getMealRecipes(weekMeal);
    const recipesInMeal = [entree, ...sides].filter(Boolean);

    const usesIt = recipesInMeal.some(recipe =>
      recipe.ingredients.some(entry => {
        if (ingredient.ingredient_id && entry.ingredient_id && entry.ingredient_id === ingredient.ingredient_id) {
          return true;
        }
        return Boolean(normalized) && normalizeName(entry.ingredient_name) === normalized;
      })
    );

    if (usesIt) {
      const label = getWeekMealLabel(weekMeal);
      if (!labels.includes(label)) labels.push(label);
    }
  });

  return labels;
}

function sortMasterIngredients(items) {
  const mode = state.ingredientSort || 'name';
  const sorted = [...items];

  if (mode === 'type') {
    sorted.sort((a, b) => a.ingredient_type.localeCompare(b.ingredient_type) || a.ingredient_name.localeCompare(b.ingredient_name));
  } else if (mode === 'store') {
    sorted.sort((a, b) => a.default_store.localeCompare(b.default_store) || a.ingredient_name.localeCompare(b.ingredient_name));
  } else {
    sorted.sort((a, b) => a.ingredient_name.localeCompare(b.ingredient_name));
  }

  return sorted;
}

function renderAllIngredients() {
  const wrapper = document.getElementById('allIngredientsList');
  const sortSelect = document.getElementById('ingredientSortSelect');
  if (sortSelect) sortSelect.value = state.ingredientSort || 'name';

  const nameCounts = {};

  state.masterIngredients.forEach(item => {
    nameCounts[item.normalized_name] = (nameCounts[item.normalized_name] || 0) + 1;
  });

  if (!state.masterIngredients.length) {
    wrapper.innerHTML = '<p class="text-muted mb-0">No ingredients in the library yet.</p>';
    return;
  }

  const sorted = sortMasterIngredients(state.masterIngredients);

  wrapper.innerHTML = `
    <ul class="list-group">
      ${sorted.map(item => {
        const isDuplicate = nameCounts[item.normalized_name] > 1;
        const usedInMeals = getMealsUsingIngredient(item);

        return `
          <li class="list-group-item">
            <div class="d-flex justify-content-between align-items-start gap-3">
              <div class="d-flex align-items-center gap-2">
                ${ingredientIconMarkup(item, 'ingredient-icon')}
                <div>
                  <div><strong>${escapeHtml(item.ingredient_name)}</strong></div>
                  <div class="small text-muted">
                    ${escapeHtml(item.ingredient_type)} · ${escapeHtml(item.default_unit)} · ${escapeHtml(item.default_store)}
                  </div>
                  <div class="small text-muted">
                    ${usedInMeals.length ? `Used in: ${usedInMeals.map(escapeHtml).join(', ')}` : 'Not used in any current meal'}
                  </div>
                </div>
              </div>

              <div>
                ${isDuplicate
                  ? '<span class="badge text-bg-warning">Possible Duplicate</span>'
                  : '<span class="badge text-bg-light">OK</span>'}
              </div>
            </div>
          </li>
        `;
      }).join('')}
    </ul>
  `;
}

function exportRecipeCard(recipeId) {
  const recipe = getRecipeById(recipeId);
  if (!recipe) return;

  const recipeCard = {
    app: 'Pangea Grocery List (PGL)',
    type: 'recipe_card',
    version: '1.0',
    recipe_title: recipe.recipe_title,
    recipe_description: recipe.recipe_description,
    recipe_icons: recipe.recipe_icons,
    dish_role: recipe.dish_role,
    ingredients: recipe.ingredients,
    directions: recipe.directions,
    credit: recipe.credit
  };

  const recipeText = JSON.stringify(recipeCard, null, 2);

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(recipeText)
      .then(() => alert('Recipe card copied to clipboard.'))
      .catch(() => {
        prompt('Copy this recipe card:', recipeText);
      });
  } else {
    prompt('Copy this recipe card:', recipeText);
  }
}

function attachEvents() {
  document.getElementById('openAppBtn').addEventListener('click', openApp);
  document.getElementById('backToIntroBtn').addEventListener('click', backToIntro);

  document.querySelectorAll('#appTabs .nav-link').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.view));
  });

  document.getElementById('addIngredientBtn').addEventListener('click', addIngredientToSelectedRecipe);

  document.getElementById('recipeForm').addEventListener('submit', saveSelectedRecipe);

  document.getElementById('generateListBtn').addEventListener('click', () => {
    generateGroceryList();
    showView('groceryView');
  });

  document.getElementById('resetEditorBtn').addEventListener('click', renderRecipeEditor);

  document.getElementById('backToWeekBtn').addEventListener('click', () => {
    showView(state.recipeDetailReturnView || 'weekView');
  });

  document.getElementById('backFromMealSummaryBtn').addEventListener('click', () => {
    showView('weekView');
  });

  document.getElementById('backToRecipeListBtn').addEventListener('click', () => {
    showView('recipeListView');
  });

  document.getElementById('viewSelectedRecipeBtn').addEventListener('click', () => {
    if (state.selectedRecipeId) openRecipeDetail(state.selectedRecipeId, 'editView');
  });

  document.getElementById('addNewRecipeBtn').addEventListener('click', createNewRecipe);
  document.getElementById('addMealBtn').addEventListener('click', createNewWeekMeal);

  document.getElementById('ingredientEditorList').addEventListener('click', event => {
    const btn = event.target.closest('.remove-ingredient-btn');
    if (!btn) return;
    removeIngredientFromSelectedRecipe(Number(btn.dataset.index));
  });

  document.getElementById('weekSortSelect').addEventListener('change', event => {
    state.weekSort = event.target.value;
    saveState();
    renderWeekMeals();
  });

  document.getElementById('groceryGroups').addEventListener('change', event => {
    if (!event.target.classList.contains('grocery-check')) return;

    const item = state.groceryList.find(entry => entry.key === event.target.dataset.key);
    if (!item) return;

    item.checked = event.target.checked;
    saveState();
    renderGroceryList();
  });

  document.getElementById('grocerySortSelect').addEventListener('change', event => {
    state.grocerySort = event.target.value;
    saveState();
    renderGroceryList();
  });

  document.getElementById('shareGroceryListBtn').addEventListener('click', shareGroceryList);

  document.getElementById('extraItemForm').addEventListener('submit', event => {
    event.preventDefault();
    const input = document.getElementById('extraItemInput');
    addExtraGroceryItem(input.value);
    input.value = '';
    input.focus();
  });

  document.getElementById('extraItemsList').addEventListener('change', event => {
    if (!event.target.classList.contains('extra-item-check')) return;

    const item = (state.extraGroceryItems || []).find(entry => entry.extra_item_id === event.target.dataset.id);
    if (!item) return;

    item.checked = event.target.checked;
    saveState();
    renderExtraGroceryItems();
  });

  document.getElementById('extraItemsList').addEventListener('click', event => {
    const btn = event.target.closest('.remove-extra-item-btn');
    if (!btn) return;
    removeExtraGroceryItem(btn.dataset.id);
  });

  document.getElementById('ingredientSortSelect').addEventListener('change', event => {
    state.ingredientSort = event.target.value;
    saveState();
    renderAllIngredients();
  });
}

async function init() {
  await loadInitialData();
  attachEvents();
  renderIntroInfo();
  renderWeekCalendar();
  renderRecipeList();
  renderIngredientDatalist();
  renderWeekMeals();
  renderMealCards();
  renderRecipeEditor();
  generateGroceryList();
  renderExtraGroceryItems();
  renderAllIngredients();
}

init();
