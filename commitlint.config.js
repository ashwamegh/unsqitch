module.exports = {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-empty": [2, "never"],
    "header-max-length": [2, "always", 150],
    "body-max-line-length": [2, "always", 500],
  },
};
