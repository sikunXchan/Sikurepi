# Sikurepi icon library

## Current coverage

- Dish icons: 150 files, 150 manifest entries, 150 keyword rules
- Ingredient icons: 385 files, 385 keyword-map entries
- All dish icons are 512 × 512 RGBA PNGs with transparent edge clearance.
- Ingredient source images intentionally retain their historical canvas sizes; all are RGBA PNGs and every file has a keyword-map entry.

Run `npm run audit:icons` after adding, renaming, or removing an icon. The audit checks file/map parity, dish manifest counts, dimensions, alpha, edge clearance, stored bounding boxes, and the 25 new dish-name precedence cases.

Run `npm run qa:dishes:world-02` to create a labeled 5 × 5 visual QA sheet in `.tmp/world-cuisines-02-contact-sheet.png`.

## World cuisines 02

Source: `docs/assets/source-sheets/world_cuisines_02.png`

| Row | Column 1 | Column 2 | Column 3 | Column 4 | Column 5 |
| --- | --- | --- | --- | --- | --- |
| 1 | oyakodon | gyudon | katsudon | tempura | miso_soup |
| 2 | yakisoba | teriyaki_chicken | bulgogi | tteokbokki | japchae |
| 3 | kimchi_jjigae | dim_sum | spring_rolls | sweet_sour_pork | thai_green_curry |
| 4 | laksa | nasi_goreng | chicken_tikka_masala | chana_masala | tagine |
| 5 | tabbouleh | enchiladas | tamales | mac_and_cheese | shepherds_pie |

### ImageGen prompt set

Generation used the built-in image generation/editing mode with `ramen.png`, `stew.png`, `sandwich.png`, and `sushi.png` as style references.

> Create a production-ready 5 by 5 sprite atlas of exactly 25 separate kawaii finished-dish icons, matching the supplied Sikurepi references: smooth softly shaded digital illustration, warm highlights, clean dark-brown outline, slight top-down serving angle, compact rounded silhouette, two black eyes, one small curved mouth, and subtle rosy cheeks. Use a strict invisible 5-column by 5-row grid, genuine transparent background, exactly one complete centered dish per cell, generous transparent padding, no crossing cell boundaries, and no shared shadows. Add no text, labels, logos, flags, borders, grid lines, hands, mascots, or scenery. Preserve the exact row-major dish order in the table above and keep each subject recognizable at 48–128 px.

The first generation returned an opaque checkerboard. A second built-in edit preserved all 25 dishes and replaced only the checkerboard with true RGBA transparency.

The sheet was split with largest-component isolation, a four-pixel source-cell edge inset, and a small explicit cleanup region for the green-curry cell. These options are supported by `scripts/split-icon-sheet.mjs` for future sheets.

## Global staples 01

Source: `docs/assets/source-sheets/global_staples_01.png`

| Row | Column 1 | Column 2 | Column 3 | Column 4 | Column 5 |
| --- | --- | --- | --- | --- | --- |
| 1 | peanut | walnut | cashew | pecan | macadamia |
| 2 | chestnut | sunflowerseed | pumpkinseed | chiaseed | flaxseed |
| 3 | bayleaf | nutmeg | smokedpaprika | saffron | sumac |
| 4 | fishsauce | shrimppaste | kecapmanis | molasses | condensedmilk |
| 5 | blackeyedpea | cannellinibean | jackfruit | passionfruit | durian |

### ImageGen prompt set

Generation used the built-in image generation/editing mode with `almond.png`, `cinnamon.png`, `oliveoil.png`, and `basil.png` as style references.

> Create a production-ready 5 by 5 sprite atlas of exactly 25 separate kawaii food-ingredient icons matching the supplied Sikurepi references: smooth softly shaded digital illustration, warm highlights, neat thin brown-gray outline, compact rounded silhouette, two black eyes, one small curved mouth, and subtle rosy cheeks. Use a strict invisible 5-column by 5-row grid, exactly one complete centered subject per cell, generous transparent padding, no crossing cell boundaries, and no shared shadows. Add no text, letters, labels, logos, flags, borders, grid lines, plates, scenery, hands, or mascot characters. Preserve the exact row-major ingredient order in the table above and keep every subject recognizable at 48–96 px.

Three built-in background-extraction edits were attempted, but the service continued returning an RGB checkerboard. `scripts/remove-checkerboard-background.mjs` therefore performs deterministic fallback extraction: only low-chroma checker pixels connected to the canvas edge become transparent, while outlined subject interiors remain untouched.

The sheet was split to the ingredient library's compact 224 px format. The result was visually inspected as a labeled 5 × 5 contact sheet, with two bottom-edge neighbor fragments explicitly removed during splitting.
