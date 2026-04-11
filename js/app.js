const ingredientTypes = [
  'Produce',
  'Meat',
  'Dairy',
  'Dry Goods',
  'Spices',
  'Sauces',
  'Other'
];

const stores = ['Walmart', 'Costco', 'Target', 'King Soopers', 'Other'];

const STORAGE_KEY = 'weekly_grocery_app_state';

const defaultState = {
  meals: [],
  masterIngredients: [],
  selectedMealId: '',
  groceryList: []
};

let state = structuredClone(defaultState);

function normalizeName(value) {
  return value.toLowerCase().trim().replace(/\s+/g, ' ');
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function loadSavedState() {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return false;

  try {
    state = JSON.parse(saved);
    return true;
  } catch (error) {
    console.error('Failed to parse saved state:', error);
    return false;
  }
}

async function loadInitialData() {
  const hasSavedState = loadSavedState();
  if (hasSavedState) return;

  const [mealsResponse, ingredientsResponse] = await Promise.all([
    fetch('data/meals.json'),
    fetch('data/ingredients.json')
  ]);

  const meals = await mealsResponse.json();
  const masterIngredients = await ingredientsResponse.json();

  state = {
    meals,
    masterIngredients,
    selectedMealId: meals[0]?.meal_id || '',
    groceryList: []
  };

  saveState();
}

function showView(viewId) {
  document.querySelectorAll('.view-section').forEach(section => {
    section.classList.toggle('d-none', section.id !== viewId);
  });

  document.querySelectorAll('#appTabs .nav-link').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.view === viewId);
  });
}

function renderWeekMeals() {
  const weekMeals = state.meals.filter(meal => meal.is_current_week).slice(0, 6);
  const grid = document.getElementById('weekMealsGrid');
  const count = document.getElementById('weekMealCount');
  count.textContent = `${weekMeals.length} / 6 meals`;

  grid.innerHTML = weekMeals.map(meal => `
    <div class="col-12 col-md-6">
      <div class="card meal-card">
        <div class="card-body d-flex gap-3 align-items-start">
          <img class="meal-thumb" src="${meal.meal_image}" alt="${meal.meal_title}" />
          <div class="flex-grow-1">
            <div class="d-flex justify-content-between align-items-start gap-2">
              <div>
                <h3 class="h6 mb-1">${meal.meal_title}</h3>
                <p class="text-muted small mb-2">${meal.meal_description}</p>
              </div>
              <button class="btn btn-sm btn-outline-primary" onclick="openMealEditor('${meal.meal_id}')">Edit</button>
            </div>
            <div class="d-flex flex-wrap gap-2">
              <span class="badge ${meal.is_active ? 'text-bg-success' : 'text-bg-secondary'}">
                ${meal.is_active ? 'Active' : 'Inactive'}
              </span>
              ${meal.is_favorite ? '<span class="badge badge-soft">Favorite</span>' : ''}
              <span class="badge text-bg-light">Current Week</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function ingredientSuggestions(inputValue) {
  const normalized = normalizeName(inputValue);
  if (!normalized) return [];

  return state.masterIngredients.filter(item =>
    item.normalized_name.includes(normalized)
  ).slice(0, 5);
}

function renderMealEditor() {
  const meal = state.meals.find(item => item.meal_id === state.selectedMealId);
  if (!meal) return;

  document.getElementById('mealTitle').value = meal.meal_title;
  document.getElementById('mealDescription').value = meal.meal_description;
  document.getElementById('mealPreview').src = meal.meal_image;
  document.getElementById('mealFavorite').checked = meal.is_favorite;
  document.getElementById('mealActive').checked = meal.is_active;

  const list = document.getElementById('ingredientEditorList');
  list.innerHTML = meal.ingredients.map((ingredient, index) => {
    const suggestions = ingredientSuggestions(ingredient.ingredient_name);
    const suggestionsHtml = suggestions.length
      ? `<div class="small text-muted mt-1">Suggestions: ${suggestions.map(s => s.ingredient_name).join(', ')}</div>`
      : `<div class="small text-warning mt-1">No match found. Confirm as a new ingredient before saving later.</div>`;

    return `
      <div class="ingredient-row py-3">
        <div class="row g-2 align-items-end">
          <div class="col-12 col-md-4">
            <label class="form-label">Ingredient</label>
            <input class="form-control ingredient-name" data-index="${index}" value="${ingredient.ingredient_name}" />
            ${suggestionsHtml}
          </div>
          <div class="col-4 col-md-2">
            <label class="form-label">Qty</label>
            <input class="form-control ingredient-qty" data-index="${index}" type="number" min="0" step="0.25" value="${ingredient.quantity_value}" />
          </div>
          <div class="col-4 col-md-2">
            <label class="form-label">Unit</label>
            <input class="form-control ingredient-unit" data-index="${index}" value="${ingredient.quantity_unit}" />
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
  renderMealEditor();
  showView('editView');
}

function addIngredientToSelectedMeal() {
  const meal = state.meals.find(item => item.meal_id === state.selectedMealId);
  if (!meal) return;

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
  renderMealEditor();
}

function saveSelectedMeal(event) {
  event.preventDefault();

  const meal = state.meals.find(item => item.meal_id === state.selectedMealId);
  if (!meal) return;

  meal.meal_title = document.getElementById('mealTitle').value.trim();
  meal.meal_description = document.getElementById('mealDescription').value.trim();
  meal.is_favorite = document.getElementById('mealFavorite').checked;
  meal.is_active = document.getElementById('mealActive').checked;

  const nameInputs = [...document.querySelectorAll('.ingredient-name')];
  const qtyInputs = [...document.querySelectorAll('.ingredient-qty')];
  const unitInputs = [...document.querySelectorAll('.ingredient-unit')];
  const typeInputs = [...document.querySelectorAll('.ingredient-type')];
  const storeInputs = [...document.querySelectorAll('.ingredient-store')];

  meal.ingredients = nameInputs.map((input, index) => {
    const ingredientName = input.value.trim();
    const normalized = normalizeName(ingredientName);
    const existing = state.masterIngredients.find(item => item.normalized_name === normalized);

    return {
      meal_ingredient_entry_id: meal.ingredients[index]?.meal_ingredient_entry_id || `entry_${Date.now()}_${index}`,
      ingredient_id: existing ? existing.ingredient_id : '',
      ingredient_name: ingredientName,
      ingredient_type: typeInputs[index].value,
      quantity_value: Number(qtyInputs[index].value) || 1,
      quantity_unit: unitInputs[index].value.trim() || 'count',
      store_name: storeInputs[index].value
    };
  });

  saveState();
  renderWeekMeals();
  renderMealEditor();
  generateGroceryList();
  renderAllIngredients();
  alert('Meal saved. New ingredients still need a later confirm/create flow.');
}

function generateGroceryList() {
  const weekMeals = state.meals.filter(meal => meal.is_current_week);
  const merged = new Map();

  weekMeals.forEach(meal => {
    meal.ingredients.forEach(ingredient => {
      const key = `${normalizeName(ingredient.ingredient_name)}__${ingredient.quantity_unit}__${ingredient.store_name}`;

      if (!merged.has(key)) {
        merged.set(key, {
          ingredient_name: ingredient.ingredient_name,
          ingredient_type: ingredient.ingredient_type,
          total_quantity_value: Number(ingredient.quantity_value) || 0,
          quantity_unit: ingredient.quantity_unit,
          store_name: ingredient.store_name,
          meals: [meal.meal_title],
          checked: false
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
    wrapper.innerHTML = '<p class="text-muted mb-0">No grocery items yet.</p>';
    return;
  }

  const grouped = state.groceryList.reduce((acc, item) => {
    if (!acc[item.ingredient_type]) acc[item.ingredient_type] = [];
    acc[item.ingredient_type].push(item);
    return acc;
  }, {});

  wrapper.innerHTML = Object.entries(grouped).map(([group, items]) => `
    <div class="mb-4">
      <div class="tiny-label mb-2">${group}</div>
      <ul class="list-group">
        ${items.map(item => `
          <li class="list-group-item">
            <div class="form-check">
              <input class="form-check-input" type="checkbox" />
              <label class="form-check-label w-100">
                <div class="d-flex justify-content-between gap-2">
                  <strong>${item.ingredient_name}</strong>
                  <span>${item.total_quantity_value} ${item.quantity_unit}</span>
                </div>
                <div class="small text-muted">Store: ${item.store_name} · Meals: ${item.meals.join(', ')}</div>
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

  wrapper.innerHTML = `
    <ul class="list-group">
      ${state.masterIngredients.map(item => {
        const isDuplicate = nameCounts[item.normalized_name] > 1;
        return `
          <li class="list-group-item">
            <div class="d-flex justify-content-between align-items-start gap-3">
              <div>
                <div><strong>${item.ingredient_name}</strong></div>
                <div class="small text-muted">${item.ingredient_type} · ${item.default_unit} · ${item.default_store}</div>
              </div>
              <div>
                ${isDuplicate ? '<span class="badge text-bg-warning">Possible Duplicate</span>' : '<span class="badge text-bg-light">OK</span>'}
              </div>
            </div>
          </li>
        `;
      }).join('')}
    </ul>
  `;
}

function attachEvents() {
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
}

async function init() {
  await loadInitialData();
  attachEvents();
  renderWeekMeals();
  renderMealEditor();
  generateGroceryList();
  renderAllIngredients();
}

init();
