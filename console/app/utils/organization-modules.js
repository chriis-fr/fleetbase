/**
 * Modules the console admin switches on or off per organisation.
 *
 * The switch lives on the organisation (`options.modules.<name>`, set in Admin,
 * Organizations, Settings; only a console admin can change it). A module that is off is
 * never set up for that organisation: no menu item, no route, nothing downloaded.
 *
 * The console decides what to load before it knows who is signed in, so the answer from the
 * last visit is kept in this browser and used at start-up. Once the user is loaded the real
 * answer is compared with it; if they differ the page reloads once into the right set
 * (instance-initializers/chains-organization-modules.js).
 */
const CACHE_KEY = 'chains.organization-modules';
const RELOADED_KEY = 'chains.organization-modules.reloaded';

/** Module name on the organisation → the engine it switches. Off unless switched on. */
export const ADMIN_MANAGED_MODULES = {
    storefront: '@fleetbase/storefront-engine',
};

export function modulesOf(organization) {
    const given = organization?.options?.modules ?? {};
    const modules = {};
    for (const name of Object.keys(ADMIN_MANAGED_MODULES)) {
        modules[name] = given[name] === true;
    }
    return modules;
}

export function rememberedModules() {
    try {
        const remembered = JSON.parse(window.localStorage.getItem(CACHE_KEY));
        return remembered && typeof remembered === 'object' ? remembered : {};
    } catch {
        return {};
    }
}

/** The engines to leave out for a set of module switches (all of them when nothing is known). */
export function hiddenEngines(modules = {}) {
    return Object.keys(ADMIN_MANAGED_MODULES)
        .filter((name) => modules[name] !== true)
        .map((name) => ADMIN_MANAGED_MODULES[name]);
}

/**
 * Record the organisation's real switches. Returns true when they differ from what this
 * page started with and the page has not already reloaded for them.
 */
export function rememberModules(organization) {
    const company = organization?.id ?? organization?.uuid;
    if (!company) {
        return false;
    }

    const modules = modulesOf(organization);
    const before = rememberedModules();
    const changed = hiddenEngines(before.modules).join() !== hiddenEngines(modules).join();
    const stamp = `${company}:${hiddenEngines(modules).join()}`;

    try {
        window.localStorage.setItem(CACHE_KEY, JSON.stringify({ company, modules }));
        if (!changed || window.sessionStorage.getItem(RELOADED_KEY) === stamp) {
            return false;
        }
        window.sessionStorage.setItem(RELOADED_KEY, stamp);
        return true;
    } catch {
        // Storage is blocked: run with what was loaded rather than reload for ever.
        return false;
    }
}
