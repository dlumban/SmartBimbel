module.exports = {
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaFeatures: { jsx: true },
    sourceType: "module",
  },
  plugins: ["@typescript-eslint", "react"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react/jsx-runtime",
  ],
  settings: {
    react: { version: "18.3" },
  },
  root: true,
  env: {
    browser: true,
    es2022: true,
  },
  ignorePatterns: [".eslintrc.cjs", "node_modules"],
  rules: {
    "@typescript-eslint/no-explicit-any": "warn",
  },
};
