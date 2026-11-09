# BoG Design System

Source: [GTBitsOfGood/design-system](https://github.com/GTBitsOfGood/design-system).

## Installation

[bog-cli](https://github.com/GTBitsOfGood/bog-cli) copied the components into this repo:

- `src/components/Bog*/`: components and CSS modules.
- `src/utils/design-system/`: responsive hooks and shared types.
- `src/styles/globals.css`: theme, typography, and font declarations.
- `public/fonts/`: font files.
- `bog.json`: install path and component versions.

Setup used `npx bog design init`; `npx bog design edit` adds or updates components.

## Preserving

Try to avoid editing BoG* components directly since ideally the design-system is the ground truth for them.
