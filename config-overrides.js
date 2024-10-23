// import { URL } from 'url'; 
const webpack = require('webpack');

module.exports = function override(config) {
    const fallback = config.resolve.fallback || {};
    Object.assign(fallback, {
        "domain": require.resolve("domain-browser"),
        "os": require.resolve("os-browserify/browser"),
        "crypto": require.resolve("crypto-browserify"),
        "stream": require.resolve("stream-browserify"),
        "assert": require.resolve("assert"),
        "http": require.resolve("stream-http"),
        "https": require.resolve("https-browserify"),
        // "url": require.resolve("UR"),
        // "url": URL,
        "url": require.resolve('url-polyfill'),
        "path": require.resolve("path-browserify"),
        "fs": false,
        "original-fs": false,  // Disable original-fs
        "vm": require.resolve("vm-browserify"),
        "util": require.resolve("util/"),
        "buffer": require.resolve("buffer/"),
        "console": require.resolve("console-browserify"),  // Add console fallback
        "async_hooks": false,
    });

    config.resolve.fallback = fallback;
    
    config.plugins = (config.plugins || []).concat([
        new webpack.ProvidePlugin({
            process: 'process/browser',
            Buffer: ['buffer', 'Buffer']
        })
    ]);

    config.ignoreWarnings = [
        /Failed to parse source map/,
        /Critical dependency: the request of a dependency is an expression/
    ];

    return config;
}
