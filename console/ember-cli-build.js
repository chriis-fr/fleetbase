'use strict';

/** eslint-disable node/no-unpublished-require */
const EmberApp = require('ember-cli/lib/broccoli/ember-app');
const Funnel = require('broccoli-funnel');
const writeFile = require('broccoli-file-creator');
const toBoolean = require('./config/utils/to-boolean');
const intlPolyfillContext = require('./config/intl-polyfill-context');

module.exports = function (defaults) {
    const app = new EmberApp(defaults, {
        storeConfigInMeta: false,

        fingerprint: {
            // favicon/ and images/ are mounted over the built copies on the Chains server, under their
            // plain names, so a hashed name would not exist there. sw.js must keep one address.
            exclude: ['leaflet/', 'leaflet-images/', 'socketcluster-client.min.js', 'fleetbase.config.json', 'extensions.json', 'favicon/', 'images/', 'sw.js'],
        },

        liveReload: {
            options: {
                ignore: ['app/router.js'],
            },
        },

        intl: {
            silent: true,
        },

        autoImport: {
            webpack: {
                plugins: [intlPolyfillContext()],
            },
        },

        'ember-simple-auth': {
            useSessionSetupMethod: true,
        },

        babel: {
            // ember-cli-code-coverage does not instrument automatically — the app has to
            // add its babel plugin explicitly. buildBabelPlugin() returns [] unless
            // COVERAGE=true, so normal builds are unaffected.
            plugins: [require.resolve('ember-auto-import/babel-plugin'), ...require('ember-cli-code-coverage').buildBabelPlugin()],
        },
    });

    let runtimeConfigTree;
    if (toBoolean(process.env.DISABLE_RUNTIME_CONFIG)) {
        runtimeConfigTree = writeFile('fleetbase.config.json', '{}');
    } else {
        runtimeConfigTree = new Funnel('.', {
            files: ['fleetbase.config.json'],
            destDir: '/',
        });
    }

    return app.toTree([runtimeConfigTree].filter(Boolean));
};
