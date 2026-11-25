import fleetbaseApiFetch from '@fleetbase/ember-core/utils/fleetbase-api-fetch';
import { rememberModules } from '../utils/organization-modules';

/**
 * Once the user is loaded, compare the organisation's module switches with the ones this
 * page started with (utils/organization-modules.js) and reload once if they differ: after
 * a first sign-in on this browser, after the console admin flips a switch, or after signing
 * in to a different organisation.
 *
 * The organisation is asked for from the API here, not read from the record the console
 * already holds: that record can be a visit behind (seen on staging, where a switch only
 * showed on the second load), and acting on a stale answer would undo the right one.
 *
 * No `after`: an ordering hint reshuffles the other instance initializers and breaks
 * Fleet-Ops' start (see chains-store-link.js).
 */
export function initialize(appInstance) {
    const universe = appInstance.lookup('service:universe');
    const currentUser = appInstance.lookup('service:current-user');
    let asked = false;

    const check = async (companyId) => {
        if (asked || typeof companyId !== 'string' || !companyId) {
            return;
        }
        asked = true;

        try {
            const response = await fleetbaseApiFetch('GET', `companies/${companyId}`);
            const organization = response?.company ?? response;
            if (organization?.uuid === companyId && rememberModules({ id: companyId, options: organization.options })) {
                window.location.reload();
            }
        } catch {
            // Could not ask this time: carry on with what was loaded.
        }
    };

    universe.on('user.loaded', (user, organization) => check(organization?.id ?? user?.company_uuid));

    // The user may already be loaded by the time this runs (a restored session).
    if (currentUser?.companyId) {
        check(currentUser.companyId);
    }
}

export default {
    name: 'chains-organization-modules',
    initialize,
};
