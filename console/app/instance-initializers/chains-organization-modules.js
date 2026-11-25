import { rememberModules } from '../utils/organization-modules';

/**
 * Once the user is loaded, compare the organisation's module switches with the ones this
 * page started with (utils/organization-modules.js) and reload once if they differ: after
 * a first sign-in on this browser, after the console admin flips a switch, or after signing
 * in to a different organisation.
 *
 * No `after`: an ordering hint reshuffles the other instance initializers and breaks
 * Fleet-Ops' start (see chains-store-link.js).
 */
export function initialize(appInstance) {
    const universe = appInstance.lookup('service:universe');
    const currentUser = appInstance.lookup('service:current-user');

    const check = (organization) => {
        if (rememberModules(organization)) {
            window.location.reload();
        }
    };

    universe.on('user.loaded', (user, organization) => check(organization));

    // The user may already be loaded by the time this runs (a restored session).
    if (currentUser?.company?.id) {
        check(currentUser.company);
    }
}

export default {
    name: 'chains-organization-modules',
    initialize,
};
