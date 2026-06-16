// Intentionally empty. The factory uses plain CSS (no Tailwind), so PostCSS does
// nothing here. This explicit config stops the build from walking up to the main
// app's postcss/tailwind pipeline, keeping the factory self-contained.
export default {
  plugins: {},
};
