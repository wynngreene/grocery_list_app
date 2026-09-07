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
// whenever you ship a meaningful update.
const APP_VERSION = '1.0';
const APP_LAST_UPDATED = 'September 2026';

// Bump this whenever the starter data (data/meals.json / data/ingredients.json)
// changes. A saved localStorage state from an older version is treated as
// stale and discarded so everyone picks up the new defaults automatically.
const DATA_VERSION = 4;

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

const defaultState = {
  meals: [],
  masterIngredients: [],
  selectedMealId: '',
  groceryList: []
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

// Looks up the master ingredient record behind a meal/grocery ingredient entry
// (by id first, falling back to a normalized-name match), so an ingredient
// image only needs to be sourced once, on the master record.
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
  banner.textContent = 'Could not load starter recipe data (data/meals.json / data/ingredients.json). If you opened this file directly from disk, browsers block that — run it through a local server (e.g. VS Code Live Server) or view it on GitHub Pages instead.';
  shell.prepend(banner);
}

async function loadInitialData() {
  const hasSavedState = loadSavedState();
  if (hasSavedState) return;

  try {
    const [mealsResponse, ingredientsResponse] = await Promise.all([
      fetch('data/meals.json'),
      fetch('data/ingredients.json')
    ]);

    if (!mealsResponse.ok || !ingredientsResponse.ok) {
      throw new Error('One or more data files failed to load.');
    }

    const meals = await mealsResponse.json();
    const masterIngredients = await ingredientsResponse.json();

    state = {
      meals,
      masterIngredients,
      selectedMealId: meals[0]?.meal_id || '',
      groceryList: [],
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
  if (countEl) countEl.textContent = state.meals.length;
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

function renderMealSelect() {
  const select = document.getElementById('mealSelect');
  if (!select) return;

  select.innerHTML = state.meals.map(meal => `
    <option value="${meal.meal_id}" ${meal.meal_id === state.selectedMealId ? 'selected' : ''}>
      ${escapeHtml(meal.meal_title)}
    </option>
  `).join('');
}

function renderIngredientDatalist() {
  const datalist = document.getElementById('ingredientNamesList');
  if (!datalist) return;

  datalist.innerHTML = state.masterIngredients
    .map(item => `<option value="${escapeHtml(item.ingredient_name)}"></option>`)
    .join('');
}

function renderWeekMeals() {
  const weekMeals = state.meals.filter(meal => meal.is_current_week).slice(0, 6);
  const grid = document.getElementById('weekMealsGrid');
  const count = document.getElementById('weekMealCount');
  count.textContent = `${weekMeals.length} / 6 meals`;

  if (!weekMeals.length) {
    grid.innerHTML = '<p class="text-muted mb-0">No meals added to this week yet. Add some from Recipe Cards.</p>';
    return;
  }

  grid.innerHTML = weekMeals.map(meal => `
    <div class="col-12 col-md-6">
      <div class="card meal-card h-100">
        <div class="card-body d-flex gap-3 align-items-start">
          <img class="meal-thumb" src="${escapeHtml(meal.meal_image || 'https://placehold.co/100x100?text=Meal')}" alt="${escapeHtml(meal.meal_title)}" />

          <div class="flex-grow-1">
            <h3 class="h6 mb-1">${escapeHtml(meal.meal_title)}</h3>
            <p class="text-muted small mb-2">${escapeHtml(meal.meal_description)}</p>

            <div class="d-flex gap-1 mb-2 fs-5">
              ${(meal.recipe_icons || []).map(icon => `<span>${escapeHtml(icon)}</span>`).join('')}
            </div>

            <div class="d-flex flex-wrap gap-2 mb-2">
              <span class="badge ${meal.is_active ? 'text-bg-success' : 'text-bg-secondary'}">
                ${meal.is_active ? 'Active' : 'Inactive'}
              </span>

              ${meal.is_favorite ? '<span class="badge badge-soft">Favorite</span>' : ''}

              <span class="badge text-bg-light">Current Week</span>
            </div>

            <div class="d-flex gap-2 flex-wrap">
              <button class="btn btn-sm btn-outline-dark" onclick="openRecipeDetail('${meal.meal_id}')">
                View Recipe
              </button>

              <button class="btn btn-sm btn-outline-primary" onclick="openMealEditor('${meal.meal_id}')">
                Edit
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function renderRecipeCards() {
  const grid = document.getElementById('recipeCardsGrid');
  if (!grid) return;

  if (!state.meals.length) {
    grid.innerHTML = '<p class="text-muted mb-0">No recipes yet. Use Edit Meal → Add New Meal to create one.</p>';
    return;
  }

  grid.innerHTML = state.meals.map(meal => `
    <div class="col-12 col-md-6">
      <div class="card recipe-card h-100">
        <div class="card-body d-flex gap-3">
          <img class="recipe-thumb" src="${escapeHtml(meal.meal_image || 'https://placehold.co/100x100?text=Meal')}" alt="${escapeHtml(meal.meal_title)}" />

          <div class="flex-grow-1">
            <h3 class="h6 mb-1">${escapeHtml(meal.meal_title)}</h3>
            <p class="text-muted small mb-2">${escapeHtml(meal.meal_description)}</p>

            <div class="d-flex gap-2 mb-2 fs-4">
              ${(meal.recipe_icons || []).map(icon => `<span>${escapeHtml(icon)}</span>`).join('')}
            </div>

            <div class="small text-muted mb-2">
              ${meal.ingredients.length} ingredients
            </div>

            <div class="d-flex gap-2 flex-wrap">
              <button class="btn btn-sm btn-outline-dark" onclick="openRecipeDetail('${meal.meal_id}')">View</button>
              <button class="btn btn-sm btn-outline-primary" onclick="openMealEditor('${meal.meal_id}')">Edit</button>
              <button class="btn btn-sm btn-outline-success" onclick="exportRecipeCard('${meal.meal_id}')">Export</button>
              <button class="btn btn-sm ${meal.is_current_week ? 'btn-success' : 'btn-outline-success'}" onclick="toggleCurrentWeek('${meal.meal_id}')">
                ${meal.is_current_week ? 'In Week' : 'Add to Week'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function openRecipeDetail(mealId) {
  state.selectedMealId = mealId;
  saveState();
  renderMealSelect();
  renderRecipeDetail();
  showView('recipeDetailView');
}

function renderRecipeDetail() {
  const meal = state.meals.find(item => item.meal_id === state.selectedMealId);
  const wrapper = document.getElementById('recipeDetailContent');

  if (!wrapper) return;

  if (!meal) {
    wrapper.innerHTML = '<p class="text-muted mb-0">No recipe selected.</p>';
    return;
  }

  const directions = meal.directions || [];
  const credit = meal.credit || {
    created_by: 'Unknown',
    shared_by: 'Pangea Grocery List (PGL)',
    source: 'Family Recipe',
    date_added: '2026'
  };

  wrapper.innerHTML = `
    <div class="recipe-detail-header mb-4">
      <img class="recipe-hero-img mb-3" src="${escapeHtml(meal.meal_image || 'https://placehold.co/900x400?text=Meal')}" alt="${escapeHtml(meal.meal_title)}" />

      <div class="d-flex justify-content-between align-items-start gap-3 flex-wrap">
        <div>
          <h2 class="h3 mb-1">${escapeHtml(meal.meal_title)}</h2>
          <p class="text-muted mb-2">${escapeHtml(meal.meal_description)}</p>

          <div class="d-flex gap-2 fs-3 mb-3">
            ${(meal.recipe_icons || []).map(icon => `<span>${escapeHtml(icon)}</span>`).join('')}
          </div>
        </div>

        <button class="btn btn-outline-primary" onclick="openMealEditor('${meal.meal_id}')">
          Edit Recipe
        </button>
      </div>
    </div>

    <div class="card section-card mb-3">
      <div class="card-body">
        <h3 class="h5 mb-3">01 — Ingredients</h3>

        ${meal.ingredients.length ? `
          <ul class="list-group">
            ${meal.ingredients.map(ingredient => {
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

function renderMealEditor() {
  renderMealSelect();

  const meal = state.meals.find(item => item.meal_id === state.selectedMealId);
  const form = document.getElementById('mealForm');

  if (!meal) {
    if (form) form.classList.add('d-none');
    return;
  }

  if (form) form.classList.remove('d-none');

  document.getElementById('mealTitle').value = meal.meal_title;
  document.getElementById('mealDescription').value = meal.meal_description;
  document.getElementById('mealPreview').src = meal.meal_image || 'https://placehold.co/100x100?text=Meal';
  document.getElementById('mealFavorite').checked = meal.is_favorite;
  document.getElementById('mealActive').checked = meal.is_active;

  renderIngredientEditorRows();
}

// Rebuilds only the ingredient rows, without touching the title/description/toggle
// fields above them — so adding or removing a row never discards an in-progress,
// not-yet-saved edit to the rest of the form.
function renderIngredientEditorRows() {
  const meal = state.meals.find(item => item.meal_id === state.selectedMealId);
  const list = document.getElementById('ingredientEditorList');
  if (!meal || !list) return;

  if (!meal.ingredients.length) {
    list.innerHTML = '<p class="text-muted mb-0">No ingredients yet. Click "Add Ingredient" to start.</p>';
    return;
  }

  list.innerHTML = meal.ingredients.map((ingredient, index) => {
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

function openMealEditor(mealId) {
  state.selectedMealId = mealId;
  saveState();
  renderMealSelect();
  renderMealEditor();
  showView('editView');
}

function createNewMeal() {
  const newMeal = {
    meal_id: `meal_${Date.now()}`,
    meal_title: 'New Meal',
    meal_description: '',
    meal_image: 'https://placehold.co/900x400?text=New+Meal',
    is_current_week: false,
    is_active: true,
    is_favorite: false,
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

  state.meals.push(newMeal);
  state.selectedMealId = newMeal.meal_id;

  saveState();
  renderMealSelect();
  renderMealEditor();
  renderRecipeCards();
  showView('editView');

  const titleField = document.getElementById('mealTitle');
  if (titleField) {
    titleField.focus();
    titleField.select();
  }
}

function toggleCurrentWeek(mealId) {
  const meal = state.meals.find(item => item.meal_id === mealId);
  if (!meal) return;

  const currentWeekMeals = state.meals.filter(item => item.is_current_week);

  if (!meal.is_current_week && currentWeekMeals.length >= 6) {
    alert('Maximum of 6 meals for the week.');
    return;
  }

  meal.is_current_week = !meal.is_current_week;

  saveState();
  renderWeekMeals();
  renderRecipeCards();
  generateGroceryList();
}

// Reads the ingredient rows currently on screen (including anything the user
// has typed but not saved yet) back into row objects, so add/remove actions
// don't clobber in-progress edits to the other rows. Returns null if the
// ingredient form isn't rendered (e.g. no rows yet).
function captureIngredientRowsFromForm(meal) {
  const nameInputs = [...document.querySelectorAll('.ingredient-name')];
  if (!nameInputs.length) return null;

  const qtyInputs = [...document.querySelectorAll('.ingredient-qty')];
  const unitInputs = [...document.querySelectorAll('.ingredient-unit')];
  const typeInputs = [...document.querySelectorAll('.ingredient-type')];
  const storeInputs = [...document.querySelectorAll('.ingredient-store')];

  return nameInputs.map((input, index) => ({
    meal_ingredient_entry_id: meal.ingredients[index]?.meal_ingredient_entry_id || `entry_${Date.now()}_${index}`,
    ingredient_id: meal.ingredients[index]?.ingredient_id || '',
    ingredient_name: input.value,
    ingredient_type: typeInputs[index]?.value || 'Other',
    quantity_value: Number(qtyInputs[index]?.value) || 1,
    quantity_unit: unitInputs[index]?.value || 'count',
    store_name: storeInputs[index]?.value || 'Walmart'
  }));
}

function addIngredientToSelectedMeal() {
  const meal = state.meals.find(item => item.meal_id === state.selectedMealId);
  if (!meal) return;

  const capturedRows = captureIngredientRowsFromForm(meal);
  if (capturedRows) meal.ingredients = capturedRows;

  meal.ingredients.push({
    meal_ingredient_entry_id: `entry_${Date.now()}`,
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

function removeIngredientFromSelectedMeal(index) {
  const meal = state.meals.find(item => item.meal_id === state.selectedMealId);
  if (!meal) return;

  const capturedRows = captureIngredientRowsFromForm(meal);
  if (capturedRows) meal.ingredients = capturedRows;

  meal.ingredients.splice(index, 1);

  saveState();
  renderIngredientEditorRows();
}

function saveSelectedMeal(event) {
  event.preventDefault();

  const meal = state.meals.find(item => item.meal_id === state.selectedMealId);
  if (!meal) return;

  const titleValue = document.getElementById('mealTitle').value.trim();
  if (!titleValue) {
    alert('Please enter a meal title before saving.');
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
      `No matching ingredient found for: ${names}\n\nCreate ${label} in your ingredient library and save this meal?`
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

  meal.meal_title = titleValue;
  meal.meal_description = document.getElementById('mealDescription').value.trim();
  meal.is_favorite = document.getElementById('mealFavorite').checked;
  meal.is_active = document.getElementById('mealActive').checked;

  meal.ingredients = rows.map(row => {
    const normalized = normalizeName(row.name);
    const master = state.masterIngredients.find(item => item.normalized_name === normalized);
    const existingEntry = meal.ingredients.find(entry =>
      normalizeName(entry.ingredient_name) === normalized && entry.quantity_unit === row.unit
    );

    return {
      meal_ingredient_entry_id: existingEntry?.meal_ingredient_entry_id || `entry_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
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
  renderRecipeCards();
  renderMealSelect();
  renderMealEditor();
  renderRecipeDetail();
  renderIngredientDatalist();
  generateGroceryList();
  renderAllIngredients();

  alert(newRows.length
    ? `Meal saved. Added ${newRows.length} new ingredient${newRows.length === 1 ? '' : 's'} to your ingredient library.`
    : 'Meal saved.');
}

function generateGroceryList() {
  const weekMeals = state.meals.filter(meal => meal.is_current_week);
  const previousChecked = new Map(state.groceryList.map(item => [item.key, item.checked]));
  const merged = new Map();

  weekMeals.forEach(meal => {
    meal.ingredients.forEach(ingredient => {
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
          meals: [meal.meal_title],
          checked: previousChecked.get(key) || false
        });
      } else {
        const existing = merged.get(key);
        existing.total_quantity_value += Number(ingredient.quantity_value) || 0;

        if (!existing.meals.includes(meal.meal_title)) {
          existing.meals.push(meal.meal_title);
        }
      }
    });
  });

  state.groceryList = [...merged.values()];
  saveState();
  renderGroceryList();
}

function renderGroceryList() {
  const wrapper = document.getElementById('groceryGroups');

  if (!state.groceryList.length) {
    wrapper.innerHTML = '<p class="text-muted mb-0">No grocery items yet. Add meals to your current week first.</p>';
    return;
  }

  const grouped = state.groceryList.reduce((acc, item) => {
    if (!acc[item.ingredient_type]) acc[item.ingredient_type] = [];
    acc[item.ingredient_type].push(item);
    return acc;
  }, {});

  wrapper.innerHTML = Object.entries(grouped).map(([group, items]) => `
    <div class="mb-4">
      <div class="tiny-label mb-2">${escapeHtml(group)}</div>
      <ul class="list-group">
        ${items.map(item => `
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
                  Store: ${escapeHtml(item.store_name)} · Meals: ${item.meals.map(escapeHtml).join(', ')}
                </div>
              </label>
            </div>
          </li>
        `).join('')}
      </ul>
    </div>
  `).join('');
}

function renderAllIngredients() {
  const wrapper = document.getElementById('allIngredientsList');
  const nameCounts = {};

  state.masterIngredients.forEach(item => {
    nameCounts[item.normalized_name] = (nameCounts[item.normalized_name] || 0) + 1;
  });

  if (!state.masterIngredients.length) {
    wrapper.innerHTML = '<p class="text-muted mb-0">No ingredients in the library yet.</p>';
    return;
  }

  wrapper.innerHTML = `
    <ul class="list-group">
      ${state.masterIngredients.map(item => {
        const isDuplicate = nameCounts[item.normalized_name] > 1;

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

function exportRecipeCard(mealId) {
  const meal = state.meals.find(item => item.meal_id === mealId);
  if (!meal) return;

  const recipeCard = {
    app: 'Pangea Grocery List (PGL)',
    type: 'recipe_card',
    version: '1.0',
    recipe_title: meal.meal_title,
    recipe_description: meal.meal_description,
    recipe_icons: meal.recipe_icons,
    ingredients: meal.ingredients,
    directions: meal.directions,
    credit: meal.credit
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

  document.getElementById('addIngredientBtn').addEventListener('click', addIngredientToSelectedMeal);

  document.getElementById('mealForm').addEventListener('submit', saveSelectedMeal);

  document.getElementById('generateListBtn').addEventListener('click', () => {
    generateGroceryList();
    showView('groceryView');
  });

  document.getElementById('resetEditorBtn').addEventListener('click', renderMealEditor);

  document.getElementById('shareRecipeBtn').addEventListener('click', () => {
    exportRecipeCard(state.selectedMealId);
  });

  document.getElementById('backToWeekBtn').addEventListener('click', () => {
    showView('weekView');
  });

  document.getElementById('mealSelect').addEventListener('change', event => {
    state.selectedMealId = event.target.value;
    saveState();
    renderMealEditor();
  });

  document.getElementById('viewSelectedRecipeBtn').addEventListener('click', () => {
    if (state.selectedMealId) openRecipeDetail(state.selectedMealId);
  });

  document.getElementById('addNewMealBtn').addEventListener('click', createNewMeal);

  document.getElementById('ingredientEditorList').addEventListener('click', event => {
    const btn = event.target.closest('.remove-ingredient-btn');
    if (!btn) return;
    removeIngredientFromSelectedMeal(Number(btn.dataset.index));
  });

  document.getElementById('groceryGroups').addEventListener('change', event => {
    if (!event.target.classList.contains('grocery-check')) return;

    const item = state.groceryList.find(entry => entry.key === event.target.dataset.key);
    if (!item) return;

    item.checked = event.target.checked;
    saveState();
    renderGroceryList();
  });
}

async function init() {
  await loadInitialData();
  attachEvents();
  renderIntroInfo();
  renderMealSelect();
  renderIngredientDatalist();
  renderWeekMeals();
  renderRecipeCards();
  renderMealEditor();
  generateGroceryList();
  renderAllIngredients();
}

init();
