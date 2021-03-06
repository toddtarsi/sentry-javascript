Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var utils_1 = require("@sentry/utils");
var global = utils_1.getGlobalObject();
var defaultTracingOrigins = ['localhost', /^\//];
/**
 * Tracing Integration
 */
var Tracing = /** @class */ (function () {
    /**
     * Constructor for Tracing
     *
     * @param _options TracingOptions
     */
    function Tracing(_options) {
        this._options = _options;
        /**
         * @inheritDoc
         */
        this.name = Tracing.id;
        this._emitOptionsWarning = false;
        var defaults = {
            idleTimeout: 500,
            maxTransactionDuration: 600,
            shouldCreateSpanForRequest: function (url) {
                var origins = (_options && _options.tracingOrigins) || defaultTracingOrigins;
                return (origins.some(function (origin) { return utils_1.isMatchingPattern(url, origin); }) &&
                    !utils_1.isMatchingPattern(url, 'sentry_key'));
            },
            startTransactionOnLocationChange: true,
            traceFetch: true,
            traceXHR: true,
            tracesSampleRate: 1,
            tracingOrigins: defaultTracingOrigins,
        };
        // NOTE: Logger doesn't work in contructors, as it's initialized after integrations instances
        if (!_options || !Array.isArray(_options.tracingOrigins) || _options.tracingOrigins.length === 0) {
            this._emitOptionsWarning = true;
        }
        Tracing.options = this._options = tslib_1.__assign({}, defaults, _options);
    }
    /**
     * @inheritDoc
     */
    Tracing.prototype.setupOnce = function (addGlobalEventProcessor, getCurrentHub) {
        Tracing._getCurrentHub = getCurrentHub;
        if (this._emitOptionsWarning) {
            utils_1.logger.warn('Sentry: You need to define `tracingOrigins` in the options. Set an array of urls or patterns to trace.');
            utils_1.logger.warn("Sentry: We added a reasonable default for you: " + defaultTracingOrigins);
        }
        if (!Tracing._isEnabled()) {
            return;
        }
        // tslint:disable-next-line: no-non-null-assertion
        if (this._options.traceXHR !== false) {
            utils_1.addInstrumentationHandler({
                callback: xhrCallback,
                type: 'xhr',
            });
        }
        // tslint:disable-next-line: no-non-null-assertion
        if (this._options.traceFetch !== false && utils_1.supportsNativeFetch()) {
            utils_1.addInstrumentationHandler({
                callback: fetchCallback,
                type: 'fetch',
            });
        }
        // tslint:disable-next-line: no-non-null-assertion
        if (this._options.startTransactionOnLocationChange) {
            utils_1.addInstrumentationHandler({
                callback: historyCallback,
                type: 'history',
            });
        }
        if (global.location && global.location.href) {
            // `${global.location.href}` will be used a temp transaction name
            Tracing.startIdleTransaction(global.location.href, {
                op: 'pageload',
                sampled: true,
            });
        }
        // This EventProcessor makes sure that the transaction is not longer than maxTransactionDuration
        addGlobalEventProcessor(function (event) {
            var self = getCurrentHub().getIntegration(Tracing);
            if (!self) {
                return event;
            }
            if (Tracing._isEnabled()) {
                var isOutdatedTransaction = event.timestamp &&
                    event.start_timestamp &&
                    (event.timestamp - event.start_timestamp > Tracing.options.maxTransactionDuration ||
                        event.timestamp - event.start_timestamp < 0);
                if (Tracing.options.maxTransactionDuration !== 0 && event.type === 'transaction' && isOutdatedTransaction) {
                    return null;
                }
            }
            return event;
        });
    };
    /**
     * Is tracing enabled
     */
    Tracing._isEnabled = function () {
        if (Tracing._enabled !== undefined) {
            return Tracing._enabled;
        }
        // This happens only in test cases where the integration isn't initalized properly
        // tslint:disable-next-line: strict-type-predicates
        if (!Tracing.options || typeof Tracing.options.tracesSampleRate !== 'number') {
            return false;
        }
        Tracing._enabled = Math.random() > Tracing.options.tracesSampleRate ? false : true;
        return Tracing._enabled;
    };
    /**
     * Starts a Transaction waiting for activity idle to finish
     */
    Tracing.startIdleTransaction = function (name, spanContext) {
        if (!Tracing._isEnabled()) {
            // Tracing is not enabled
            return undefined;
        }
        // If we already have an active transaction it means one of two things
        // a) The user did rapid navigation changes and didn't wait until the transaction was finished
        // b) A activity wasn't popped correctly and therefore the transaction is stalling
        Tracing.finishIdleTransaction();
        var _getCurrentHub = Tracing._getCurrentHub;
        if (!_getCurrentHub) {
            return undefined;
        }
        var hub = _getCurrentHub();
        if (!hub) {
            return undefined;
        }
        var span = hub.startSpan(tslib_1.__assign({}, spanContext, { transaction: name }), true);
        Tracing._activeTransaction = span;
        // We need to do this workaround here and not use configureScope
        // Reason being at the time we start the inital transaction we do not have a client bound on the hub yet
        // therefore configureScope wouldn't be executed and we would miss setting the transaction
        // tslint:disable-next-line: no-unsafe-any
        hub.getScope().setSpan(span);
        // The reason we do this here is because of cached responses
        // If we start and transaction without an activity it would never finish since there is no activity
        var id = Tracing.pushActivity('idleTransactionStarted');
        setTimeout(function () {
            Tracing.popActivity(id);
        }, (Tracing.options && Tracing.options.idleTimeout) || 100);
        return span;
    };
    /**
     * Update transaction
     * @deprecated
     */
    Tracing.updateTransactionName = function (name) {
        var _getCurrentHub = Tracing._getCurrentHub;
        if (_getCurrentHub) {
            var hub = _getCurrentHub();
            if (hub) {
                hub.configureScope(function (scope) {
                    scope.setTransaction(name);
                });
            }
        }
    };
    /**
     * Finshes the current active transaction
     */
    Tracing.finishIdleTransaction = function () {
        var active = Tracing._activeTransaction;
        if (active) {
            // true = use timestamp of last span
            active.finish(true);
        }
    };
    /**
     * Sets the status of the current active transaction (if there is one)
     */
    Tracing.setTransactionStatus = function (status) {
        var active = Tracing._activeTransaction;
        if (active) {
            active.setStatus(status);
        }
    };
    /**
     * Starts tracking for a specifc activity
     */
    Tracing.pushActivity = function (name, spanContext) {
        if (!Tracing._isEnabled()) {
            // Tracing is not enabled
            return 0;
        }
        // We want to clear the timeout also here since we push a new activity
        clearTimeout(Tracing._debounce);
        var _getCurrentHub = Tracing._getCurrentHub;
        if (spanContext && _getCurrentHub) {
            var hub = _getCurrentHub();
            if (hub) {
                Tracing._activities[Tracing._currentIndex] = {
                    name: name,
                    span: hub.startSpan(spanContext),
                };
            }
        }
        else {
            Tracing._activities[Tracing._currentIndex] = {
                name: name,
            };
        }
        return Tracing._currentIndex++;
    };
    /**
     * Removes activity and finishes the span in case there is one
     */
    Tracing.popActivity = function (id, spanData) {
        if (!Tracing._isEnabled()) {
            // Tracing is not enabled
            return;
        }
        var activity = Tracing._activities[id];
        if (activity) {
            var span_1 = activity.span;
            if (span_1) {
                if (spanData) {
                    Object.keys(spanData).forEach(function (key) {
                        span_1.setData(key, spanData[key]);
                        if (key === 'status_code') {
                            span_1.setHttpStatus(spanData[key]);
                        }
                    });
                }
                span_1.finish();
            }
            // tslint:disable-next-line: no-dynamic-delete
            delete Tracing._activities[id];
        }
        var count = Object.keys(Tracing._activities).length;
        clearTimeout(Tracing._debounce);
        if (count === 0) {
            var timeout = Tracing.options && Tracing.options.idleTimeout;
            Tracing._debounce = setTimeout(function () {
                Tracing.finishIdleTransaction();
            }, timeout);
        }
    };
    /**
     * @inheritDoc
     */
    Tracing.id = 'Tracing';
    Tracing._currentIndex = 0;
    Tracing._activities = {};
    Tracing._debounce = 0;
    return Tracing;
}());
exports.Tracing = Tracing;
/**
 * Creates breadcrumbs from XHR API calls
 */
function xhrCallback(handlerData) {
    if (!Tracing.options.traceXHR) {
        return;
    }
    // tslint:disable-next-line: no-unsafe-any
    if (!handlerData || !handlerData.xhr || !handlerData.xhr.__sentry_xhr__) {
        return;
    }
    // tslint:disable: no-unsafe-any
    var xhr = handlerData.xhr.__sentry_xhr__;
    if (!Tracing.options.shouldCreateSpanForRequest(xhr.url)) {
        return;
    }
    // We only capture complete, non-sentry requests
    if (handlerData.xhr.__sentry_own_request__) {
        return;
    }
    if (handlerData.endTimestamp && handlerData.xhr.__sentry_xhr_activity_id__) {
        Tracing.popActivity(handlerData.xhr.__sentry_xhr_activity_id__, handlerData.xhr.__sentry_xhr__);
        return;
    }
    handlerData.xhr.__sentry_xhr_activity_id__ = Tracing.pushActivity('xhr', {
        data: tslib_1.__assign({}, xhr.data, { type: 'xhr' }),
        description: xhr.method + " " + xhr.url,
        op: 'http',
    });
    // Adding the trace header to the span
    var activity = Tracing._activities[handlerData.xhr.__sentry_xhr_activity_id__];
    if (activity) {
        var span = activity.span;
        if (span && handlerData.xhr.setRequestHeader) {
            handlerData.xhr.setRequestHeader('sentry-trace', span.toTraceparent());
        }
    }
    // tslint:enable: no-unsafe-any
}
/**
 * Creates breadcrumbs from fetch API calls
 */
function fetchCallback(handlerData) {
    // tslint:disable: no-unsafe-any
    if (!Tracing.options.traceFetch) {
        return;
    }
    if (!Tracing.options.shouldCreateSpanForRequest(handlerData.fetchData.url)) {
        return;
    }
    if (handlerData.endTimestamp && handlerData.fetchData.__activity) {
        Tracing.popActivity(handlerData.fetchData.__activity, handlerData.fetchData);
    }
    else {
        handlerData.fetchData.__activity = Tracing.pushActivity('fetch', {
            data: tslib_1.__assign({}, handlerData.fetchData, { type: 'fetch' }),
            description: handlerData.fetchData.method + " " + handlerData.fetchData.url,
            op: 'http',
        });
        var activity = Tracing._activities[handlerData.fetchData.__activity];
        if (activity) {
            var span = activity.span;
            if (span) {
                var options = (handlerData.args[1] = handlerData.args[1] || {});
                if (options.headers) {
                    if (Array.isArray(options.headers)) {
                        options.headers = tslib_1.__spread(options.headers, [{ 'sentry-trace': span.toTraceparent() }]);
                    }
                    else {
                        options.headers = tslib_1.__assign({}, options.headers, { 'sentry-trace': span.toTraceparent() });
                    }
                }
                else {
                    options.headers = { 'sentry-trace': span.toTraceparent() };
                }
            }
        }
    }
    // tslint:enable: no-unsafe-any
}
/**
 * Creates transaction from navigation changes
 */
function historyCallback(_) {
    if (Tracing.options.startTransactionOnLocationChange && global && global.location) {
        Tracing.startIdleTransaction(global.location.href, {
            op: 'navigation',
            sampled: true,
        });
    }
}
//# sourceMappingURL=tracing.js.map