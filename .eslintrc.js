module.exports = {
  extends: ["standard", "eslint:recommended", "prettier"],
  env: {
    es6: true,
  },
  overrides: [
    {
      files: ["**/*.spec.js"],
      env: {
        jest: true,
      },
    },
  ],
};
