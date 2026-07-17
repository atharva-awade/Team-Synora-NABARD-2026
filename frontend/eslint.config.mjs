import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // The mount-guard / localStorage-read-on-mount patterns (next-themes
      // hydration, saved language preference) are legitimate, unavoidable uses
      // of setState inside an effect. The React-compiler advisory rule flags
      // them as false positives, so we scope it down to a warning.
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  {
    // React-Three-Fiber scenes mutate three.js objects (materials, camera,
    // scratch vectors) inside useFrame — the correct, universal R3F pattern,
    // which runs outside React render. The React-compiler immutability rule
    // doesn't model useFrame and flags these as false positives here.
    files: ["components/three/**/*.{ts,tsx}"],
    rules: {
      "react-hooks/immutability": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
