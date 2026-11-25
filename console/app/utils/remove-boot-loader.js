/** Length of the reveal in app/index.html: the second panel finishes at 0.61s. */
const OUT_MS = 660;

/**
 * Lift the opening cover (app/index.html) once the app has something to show: the mark
 * lifts, the letters rise away and the panels open from the top. Routes call this as soon
 * as they render, often more than one of them, so a second call does nothing.
 */
export default function removeBootLoader() {
    const bootLoaderElement = document.getElementById('boot-loader');
    if (!bootLoaderElement || typeof bootLoaderElement.remove !== 'function') {
        return;
    }
    if (bootLoaderElement.dataset.leaving) {
        return;
    }

    bootLoaderElement.dataset.leaving = 'true';
    bootLoaderElement.classList.add('fx-out');
    setTimeout(() => bootLoaderElement.remove(), OUT_MS);
}
