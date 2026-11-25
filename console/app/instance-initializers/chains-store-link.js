import config from '@fleetbase/console/config/environment';

/**
 * The "Storefront" item in the top menu opens the business's own web store.
 *
 * Chains stores are web shops that run on chains-API, not on Fleetbase's Storefront
 * module, so that module is left out of this console (EXCLUDED_EXTENSIONS). The address
 * is set for the organisation in the Chains admin portal, and saved there only once the
 * store proves it holds the organisation's storefront key. This asks chains-API for it
 * each time the console opens, so changing it in Chains changes it here with nothing to
 * keep in step. An organisation with no verified address gets no item.
 *
 * Switching organisation reloads the console (controllers/console.js), so one lookup per
 * page load is enough.
 */
export function initialize(appInstance) {
    const universe = appInstance.lookup('service:universe');
    const currentUser = appInstance.lookup('service:current-user');
    const apiUrl = String(config.chains?.apiUrl ?? '').replace(/\/+$/, '');
    let asked = false;

    const showStoreLink = async (companyIds) => {
        // FleetOps names a company by a uuid and by a public id; either may be the one Chains holds.
        const ids = [...new Set(companyIds.filter((id) => typeof id === 'string' && id))];
        if (asked || !apiUrl || ids.length === 0) {
            return;
        }
        asked = true;

        try {
            const response = await fetch(`${apiUrl}/api/logistics/store-link?company=${encodeURIComponent(ids.join(','))}`, {
                headers: { Accept: 'application/json' },
            });
            if (!response.ok) {
                return;
            }
            const { url } = await response.json();
            if (typeof url !== 'string' || !url.startsWith('https://')) {
                return;
            }

            universe.getService('menu').registerHeaderMenuItem('Storefront', null, {
                id: 'chains-storefront',
                slug: 'chains-storefront',
                icon: 'store',
                priority: 1,
                description: 'Open your web store in a new tab.',
                onClick: () => window.open(url, '_blank', 'noopener,noreferrer'),
            });
        } catch {
            // No link this time; the console works the same without it.
        }
    };

    universe.on('user.loaded', (user, organization) => showStoreLink([organization?.id, organization?.public_id, user?.company_uuid]));

    // The user may already be loaded by the time this runs (a restored session).
    if (currentUser?.companyId) {
        showStoreLink([currentUser.companyId, currentUser.company?.public_id]);
    }
}

// No `after`: an ordering hint here reshuffles the app's other instance initializers, and
// Fleet-Ops then starts with a universe service that has no application instance yet
// (seen on staging: "this.universe.getApplicationInstance is not a function" on the orders
// page). This initializer needs no order: it only listens, and acts once a user is loaded.
export default {
    name: 'chains-store-link',
    initialize,
};
