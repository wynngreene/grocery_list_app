# Pangea Grocery List (PGL) — Feature Roadmap

Grouped by level of work, not by when you'll get to them. Within each tier, items are roughly in the order that makes sense to build (earlier items often unblock later ones in the same tier).

---

## Tier 1 — Low Effort (hours, mostly UI/CRUD on data you already have)

**Already built and tested:**
- Weekly menu with a 6-meal cap
- Full recipe CRUD (create, edit, view) with title, description, image, icons, favorite/active flags
- Ingredient CRUD with duplicate detection, autocomplete, and a confirm-before-creating-a-new-ingredient flow
- Grocery list generation from the current week, merged/deduped by ingredient, grouped by category, with working check-off boxes
- Recipe Card export (copies a JSON snapshot of a recipe to your clipboard)
- All 6 views (Week Menu, Recipe Cards, Recipe Detail, Edit Meal, Grocery List, All Ingredients) with tab navigation

**Still to do, low effort:**
- Delete a recipe (currently you can only edit or deactivate one)
- A merge tool on the All Ingredients page for the duplicates it already flags (e.g. the "lettuce" / "Lettuce" case)
- Search/filter recipes by name or favorite status
- Reorder or assign specific days to weekly menu items (currently it's just a flat list of up to 6)
- A "clear all checked items" button on the grocery list
- Dark mode (styling only — no data changes needed)

---

## Tier 2 — Medium Effort (the Supabase migration — this is the big one)

- ✅ Database schema + Row Level Security policies written (`supabase/schema.sql` in your repo, not yet run)
- Run the schema in Supabase and turn on Auth (email/password)
- Household creation and an invite/join flow so you and your wife land in the same household
- The actual rewrite: swap every `localStorage` read/write in `app.js` for Supabase client calls — recipes, ingredients, and weekly menus each need this
- Realtime sync (Supabase Realtime) so a change on one phone shows up on the other without a manual refresh
- Basic recipe image upload to Supabase Storage (no compression yet — that's Tier 3)

This tier is the one that actually delivers on "my phone and my wife's phone see the same data" — everything in Tier 1 works today without it, but nothing syncs between devices until this is done.

---

## Tier 3 — Higher Effort (real feature builds, roughly a week or more each)

- Client-side image compression before upload (resize to ~1200px, JPEG compress to ~150–300KB) so phone photos don't bloat your storage bucket
- Ingredient images — sourcing a small image per ingredient and wiring it into the ingredient records (see the database comparison below)
- Recipe import/export as a real shareable `.json` "Recipe Card" file (not just clipboard copy) — includes validating a file someone hands you before trusting its structure
- Turning `store_name` into its own real table instead of free text, if store management gets more involved than the current 5-store list
- Pantry tracking — mark what you already have on hand so the grocery list can exclude it
- A simple meal history / "recently cooked" log

---

## Tier 4 — Advanced / Long-Term (weeks+, genuinely "social app" scope)

- True recipe sharing between separate households (not just export/import a file — an actual "send this recipe to another Pangea user" flow, which needs its own sharing rules in RLS)
- Recipe ratings and comments
- A public or community recipe feed
- Friends / following
- Barcode scanning for packaged goods (this is where Open Food Facts becomes genuinely useful — see below)
- Nutrition info (USDA FoodData Central)
- AI-assisted recipe suggestions based on what's in your pantry

Your original project brief already flagged everything in this tier as "don't build yet" — that's still the right call. It's listed here for completeness, not as a suggestion to start soon.

---

## Where ingredient/recipe images should come from

You mentioned [FooDB](https://foodb.ca/) — I checked it directly. It's not actually an image database: it's a food *chemistry* database (flavor compounds, nutrients, biomarkers) built for nutrition research, and it doesn't provide photos at all. Its license is also Creative Commons Attribution-NonCommercial 4.0, meaning commercial use requires explicit permission from the authors — worth knowing even for a personal project, though non-commercial personal use is likely fine. Either way, it's the wrong tool for pictures.

Here's what I'd actually use instead, split by what the image is *for*:

**For small ingredient icons** (the kind shown next to "Ground Beef" or "Yellow Onion" in the ingredient library) — [TheMealDB](https://www.themealdb.com/api.php) is the best fit. It has a dedicated ingredient-image endpoint with predictable URLs (`themealdb.com/images/ingredients/<name>.png`, in small/medium/large sizes) built specifically for this use case, it's free at the point of access, and your own original project brief already named TheMealDB as a reference source — so this isn't a new dependency, just using more of what you'd already considered. The free tier caps at 100 items, which comfortably covers your planned 100–200 starter ingredients.

**For recipe hero photos** (the big appetizing image at the top of a Recipe Card) — [Unsplash's API](https://unsplash.com/documentation) is the better choice: real food photography, explicitly free for both personal and commercial use, no image-request rate limit (only API search requests are capped, at 1000/hour once approved for production). The catch is it requires hotlinking the returned URL directly and crediting the photographer — which actually fits how your `meal_image` field already works today (it's already just a URL, same as your current placeholder images).

**Not recommended for now:** [Open Food Facts](https://world.openfoodfacts.org/data) is a genuinely great free database, but it's built around photos of packaged product *boxes* (a specific brand of pasta sauce, not "pasta sauce" generically) under a CC BY-SA license — a better fit for Tier 4's barcode-scanning feature later than for everyday recipe/ingredient images now.

**Bottom line:** TheMealDB for ingredient icons, Unsplash for recipe photos, skip FooDB for images entirely (though it could be a legitimate future source for the Tier 4 nutrition-info feature, since that actually is its purpose).

Sources: [foodb.ca](https://foodb.ca/) · [TheMealDB API](https://www.themealdb.com/api.php) · [Unsplash API docs](https://unsplash.com/documentation) · [Open Food Facts data](https://world.openfoodfacts.org/data)
