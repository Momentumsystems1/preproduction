/**
 * Lightweight debug logger.
 * - In development → forwards to console.debug (visible in DevTools).
 * - In production builds → no-op (zero console pollution).
 */
const IS_DEV = process.env.NODE_ENV !== "production";

export const debug = IS_DEV
  ? (...args) => console.debug(...args)  // eslint-disable-line no-console
  : () => {};

export default debug;
