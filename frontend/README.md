This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Tailwind CSS

This project uses **Tailwind CSS v4** (`tailwindcss` ^4, `@tailwindcss/postcss`) — it satisfies the “v3+” requirement and matches Next.js 16’s PostCSS setup.

- **Scan paths:** `src/app/globals.css` uses `@import "tailwindcss" source("../../src");` so all classes under `src/` are detected ([docs](https://tailwindcss.com/docs/detecting-classes-in-source-files)).
- **Config:** `tailwind.config.ts` is present for tooling (IntelliSense); theme tokens live in `globals.css` (`@theme inline`).
- **Opacity utilities:** Prefer `border-white/8` over `border-white/[0.08]` — same visual result, better editor/regex behavior.

**VS Code:** Install the [Tailwind CSS IntelliSense](https://marketplace.visualstudio.com/items?itemName=bradlc.vscode-tailwindcss) extension. Workspace settings include `tailwindCSS.experimental.classRegex` for `className="..."` strings.

## Source layout

- `src/app/` — App Router pages and layouts
- `src/components/` — UI components (include `"use client"` when using browser APIs)
- `src/hooks/` — React hooks (e.g. `useAuth` for client session snapshot)
- `src/lib/` — App utilities (API client, motion presets, copy)
- `src/utils/` — Shared helpers (`storage.ts` wraps `localStorage` for auth keys)
- `src/constants/` — Shared constants (e.g. storage key names)

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
