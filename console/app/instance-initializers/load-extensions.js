import { hiddenEngines, rememberedModules } from '../utils/organization-modules';

/**
 * Load extensions from the API using ExtensionManager
 * This must run before other initializers that depend on extensions
 */
export async function initialize(appInstance) {
    const application = appInstance.application;
    const extensionManager = appInstance.lookup('service:universe/extension-manager');

    // Modules the console admin has not switched on for this organisation are dropped from
    // the list before anything is set up from it (utils/organization-modules.js). The
    // manager announces the list as loaded from inside loadExtensions, so the drop has to
    // happen at that moment, not after the await below.
    const hidden = hiddenEngines(rememberedModules().modules);
    const finishLoadingExtensions = extensionManager.finishLoadingExtensions.bind(extensionManager);
    extensionManager.finishLoadingExtensions = () => {
        extensionManager.finishLoadingExtensions = finishLoadingExtensions;
        if (Array.isArray(application.extensions)) {
            application.extensions = application.extensions.filter((extension) => !hidden.includes(extension.name ?? extension));
            for (const name of hidden) {
                delete application.engines?.[name];
            }
        }
        finishLoadingExtensions();
    };

    try {
        await extensionManager.loadExtensions(application);
    } catch (error) {
        console.error('[load-extensions] Error:', error);
    }
}

export default {
    name: 'load-extensions',
    initialize,
};
