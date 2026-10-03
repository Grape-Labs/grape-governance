'use strict';

// download@7 expects a callable CommonJS export; the maintained extractor is ESM.
module.exports = (...args) =>
    import('@xhmikosr/decompress').then(({ default: decompress }) => decompress(...args));
