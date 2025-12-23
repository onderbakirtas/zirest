# Development

## Prerequisites

- Node.js + npm
- GJS
- GTK 4
- Libadwaita
- GtkSourceView 5
- libsoup 3

(Exact package names depend on your distribution.)

## Project layout

- `main.ts`: GJS entrypoint (bundled by Vite)
- `src/`: application code
- `dist/bundle.js`: build output

## Scripts

- Install dependencies:

```sh
npm install
```

- Type-check:

```sh
npm run check
```

- Build:

```sh
npm run build
```

- Run built bundle:

```sh
npm run start
```

- Build and run:

```sh
npm run br
```

- Run with GTK inspector:

```sh
npm run start:debug
```

## Notes

- The Vite build targets Firefox compatibility for your installed GJS version (see `vite.config.js`).
- If you change GNOME/GTK dependencies, make sure they are marked as external in `vite.config.js` so they are not bundled.
