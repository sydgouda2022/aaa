// Static, offline-first PWA. Egyptian dates are calculated in the browser;
// unlike ICS feeds, calendar dates render inside actual day cells, not events.
export default {
  async fetch(request, env) {
    return env.ASSETS.fetch(request);
  }
};
