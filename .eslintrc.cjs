/** @type {import("eslint").Linter.Config} */
module.exports = {
  root: true,
  env: {
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/eslint-recommended",
    "plugin:astro/recommended",
    "prettier",
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": "warn",
  },
  overrides: [
    {
      // Define the configuration for `.astro` file.
      files: ["*.astro"],
      // Allows Astro components to be parsed.
      parser: "astro-eslint-parser",
      // Parse the script in `.astro` as TypeScript by adding the following configuration.
      // It's the setting you need when using TypeScript.
      parserOptions: {
        parser: "@typescript-eslint/parser",
        extraFileExtensions: [".astro"],
      },
      rules: {
        // override/add rules settings here, such as:
        // "astro/no-set-html-directive": "error"
      },
    },
    {
      files: ["*.jsx", "*.tsx"],
      extends: ["plugin:react/recommended"],
      rules: {
        "react/react-in-jsx-scope": "off",
      },
      settings: {
        react: {
          version: "detect",
        },
      },
    },
  ],
};
