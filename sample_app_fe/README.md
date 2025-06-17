# Using npm

```bash
npm create vite@latest my-project -- --template react-ts
```

# Using yarn

```bash
yarn create vite my-project --template react-ts
```

# initialize yarn

```bash
yarn (use yarn classic (not berry))
```

# setup tailwind css

```bash
yarn add -D tailwindcss postcss autoprefixer
yarn tailwindcss init -p
```

# update tailwind.config.js

```js
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

## update packages interractively

```bash
yarn up -i | yarn up "*"
```

# use huskey to update packages

```bash
yarn dlx husky-init && yarn
# OR (for npm)
npx husky-init && npm install
```
