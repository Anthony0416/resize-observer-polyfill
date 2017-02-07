import {Map} from './shims/es6-collections';
import ResizeObservation from './ResizeObservation';
import ResizeObserverEntry from './ResizeObserverEntry';
import global from './shims/global';

export default class ResizeObserverSPI {
    /**
     * Collection of resize observations that have detected changes in dimensions
     * of elements.
     *
     * Spec: https://wicg.github.io/ResizeObserver/#dom-resizeobserver-activetargets
     *
     * @private
     * @type {Array}
     */
    _activeTargets = [];

    /**
     * Reference to the callback function.
     * Spec: https://wicg.github.io/ResizeObserver/#resize-observer-callback
     *
     * @private
     * @type {Function}
     */
    _callback;

    /**
     * Public ResizeObserver instance which will be passed to the callback
     * function and used as a value of it's "this" binding.
     *
     * @private
     * @type {ResizeObserver}
     */
    _callbackCtx;

    /**
     * Reference to the associated ResizeObserverController.
     *
     * @private
     * @type {ResizeObserverController}
     */
    _controller;

    /**
     * Registry of the ResizeObservation instances.
     * Spec: https://wicg.github.io/ResizeObserver/#dom-resizeobserver-observationtargets
     *
     * @private
     * @type {Map}
     */
    _observationTargets = new Map();

    /**
     * Creates a new instance of ResizeObserver.
     *
     * @param {ResizeObserverCallback} callback - Callback function that is invoked when one
     *      of the observed elements changes it's content dimensions.
     * @param {ResizeObserverController} controller - Controller instance which
     *      is responsible for the updates of observer.
     * @param {ResizeObserver} callbackCtx - Reference to the public
     *      ResizeObserver instance which will be passed to callback function.
     */
    constructor(callback, controller, callbackCtx) {
        if (typeof callback !== 'function') {
            throw new TypeError('The callback provided as parameter 1 is not a function.');
        }

        this._callback = callback;
        this._controller = controller;
        this._callbackCtx = callbackCtx;
    }

    /**
     * Starts observing provided element.
     * Spec: https://wicg.github.io/ResizeObserver/#dom-resizeobserver-observe
     *
     * @param {Element} target - Element to be observed.
     * @returns {void}
     */
    observe(target) {
        if (!arguments.length) {
            throw new TypeError('1 argument required, but only 0 present.');
        }

        // Do nothing if current environment doesn't have the Element interface.
        if (!('Element' in global) || !(Element instanceof Object)) {
            return;
        }

        if (!(target instanceof Element)) {
            throw new TypeError('parameter 1 is not of type "Element".');
        }

        const targets = this._observationTargets;

        // Do nothing if element is already being observed.
        if (targets.has(target)) {
            return;
        }

        // Register new ResizeObservation instance.
        targets.set(target, new ResizeObservation(target));

        // Add observer to controller if it hasn't been connected yet.
        if (!this._controller.isConnected(this)) {
            this._controller.connect(this);
        }

        // Force the update of observations.
        this._controller.refresh();
    }

    /**
     * Stops observing provided element.
     * Spec: https://wicg.github.io/ResizeObserver/#dom-resizeobserver-unobserve
     *
     * @param {Element} target - Element to stop observing.
     * @returns {void}
     */
    unobserve(target) {
        if (!arguments.length) {
            throw new TypeError('1 argument required, but only 0 present.');
        }

        // Do nothing if current environment doesn't have the Element interface.
        if (!('Element' in global) || !(Element instanceof Object)) {
            return;
        }

        if (!(target instanceof Element)) {
            throw new TypeError('parameter 1 is not of type "Element".');
        }

        const targets = this._observationTargets;

        // Do nothing if element is not being observed.
        if (!targets.has(target)) {
            return;
        }

        // Remove element and associated with it ResizeObsrvation instance from
        // registry.
        targets.delete(target);

        // Set back the initial state if there is nothing to observe.
        if (!targets.size) {
            this.disconnect();
        }
    }

    /**
     * Stops observing all elements and clears the observations list.
     * Spec: https://wicg.github.io/ResizeObserver/#dom-resizeobserver-disconnect
     *
     * @returns {void}
     */
    disconnect() {
        this.clearActive();
        this._observationTargets.clear();
        this._controller.disconnect(this);
    }

    /**
     * Clears an array of previously collected active observations and collects
     * observation instances which associated element has changed it's content
     * rectangle.
     *
     * @returns {void}
     */
    gatherActive() {
        this.clearActive();

        const activeTargets = this._activeTargets;

        this._observationTargets.forEach(observation => {
            if (observation.isActive()) {
                activeTargets.push(observation);
            }
        });
    }

    /**
     * Invokes initial callback function with a list of ResizeObserverEntry
     * instances collected from active resize observations.
     *
     * @returns {void}
     */
    broadcastActive() {
        // Do nothing if observer doesn't have active observations.
        if (!this.hasActive()) {
            return;
        }

        const ctx = this._callbackCtx;

        // Create ResizeObserverEntry instance for every active observation.
        const entries = this._activeTargets.map(observation => {
            return new ResizeObserverEntry(
                observation.target,
                observation.broadcastRect()
            );
        });

        this._callback.call(ctx, entries, ctx);
        this.clearActive();
    }

    /**
     * Clears the collection of pending/active observations.
     *
     * @returns {void}
     */
    clearActive() {
        this._activeTargets.splice(0);
    }

    /**
     * Tells whether observer has pending observations.
     *
     * @returns {boolean}
     */
    hasActive() {
        return !!this._activeTargets.length;
    }
}
