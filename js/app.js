if (saved) {
    state = JSON.parse(saved);
  } else {
    const res = await fetch("data/meals.json");
    state.meals = await res.json();
    saveState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderMeals() {
  const container = document.getElementById("weekMeals");

  container.innerHTML = state.meals.map(meal => `
    <div class="meal-card">
      <strong>${meal.meal_title}</strong><br/>
      ${meal.meal_description}
    </div>
  `).join("");
}

function generateGroceryList() {
  const map = {};

  state.meals.forEach(meal => {
    meal.ingredients.forEach(i => {
      const key = i.ingredient_name.toLowerCase();

      if (!map[key]) {
        map[key] = { ...i };
      } else {
        map[key].quantity_value += i.quantity_value;
      }
    });
  });

  renderGrocery(map);
}

function renderGrocery(map) {
  const container = document.getElementById("groceryList");

  container.innerHTML = Object.values(map).map(i => `
    <div>
      [ ] ${i.ingredient_name} - ${i.quantity_value} ${i.quantity_unit}
    </div>
  `).join("");
}

async function init() {
  await loadInitialData();
  renderMeals();

  document.getElementById("generateBtn").onclick = generateGroceryList;
}

init();
