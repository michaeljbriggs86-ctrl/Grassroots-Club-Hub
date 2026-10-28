// The deployed entrypoint exports only the Worker handler. Parser helpers and
// constants remain importable from src/index.mjs by tests and private tooling.
export { default } from './src/index.mjs';
