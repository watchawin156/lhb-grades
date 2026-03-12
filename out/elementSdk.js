/**
 * elementSdk.js - Config handler
 */
window.elementSdk = {
  init: function(options) {
    if (options.onConfigChange) {
      options.onConfigChange(options.defaultConfig);
    }
  }
};
