Object.defineProperty(exports, "__esModule", { value: true });
var core_1 = require("@sentry/core");
var utils_1 = require("@sentry/utils");
var NODE_VERSION = utils_1.parseSemver(process.versions.node);
/** http module integration */
var Http = /** @class */ (function () {
    /**
     * @inheritDoc
     */
    function Http(options) {
        if (options === void 0) { options = {}; }
        /**
         * @inheritDoc
         */
        this.name = Http.id;
        this._breadcrumbs = typeof options.breadcrumbs === 'undefined' ? true : options.breadcrumbs;
        this._tracing = typeof options.tracing === 'undefined' ? false : options.tracing;
    }
    /**
     * @inheritDoc
     */
    Http.prototype.setupOnce = function () {
        // No need to instrument if we don't want to track anything
        if (!this._breadcrumbs && !this._tracing) {
            return;
        }
        var handlerWrapper = createHandlerWrapper(this._breadcrumbs, this._tracing);
        var httpModule = require('http');
        utils_1.fill(httpModule, 'get', handlerWrapper);
        utils_1.fill(httpModule, 'request', handlerWrapper);
        // NOTE: Prior to Node 9, `https` used internals of `http` module, thus we don't patch it.
        // If we do, we'd get double breadcrumbs and double spans for `https` calls.
        // It has been changed in Node 9, so for all versions equal and above, we patch `https` separately.
        if (NODE_VERSION.major && NODE_VERSION.major > 8) {
            var httpsModule = require('https');
            utils_1.fill(httpsModule, 'get', handlerWrapper);
            utils_1.fill(httpsModule, 'request', handlerWrapper);
        }
    };
    /**
     * @inheritDoc
     */
    Http.id = 'Http';
    return Http;
}());
exports.Http = Http;
/**
 * Wrapper function for internal `request` and `get` calls within `http` and `https` modules
 */
function createHandlerWrapper(breadcrumbsEnabled, tracingEnabled) {
    return function handlerWrapper(originalHandler) {
        return function (options) {
            var requestUrl = extractUrl(options);
            if (isSentryRequest(requestUrl)) {
                return originalHandler.apply(this, arguments);
            }
            var span;
            if (tracingEnabled) {
                span = core_1.getCurrentHub().startSpan({
                    description: (typeof options === 'string' || !options.method ? 'GET' : options.method) + "|" + requestUrl,
                    op: 'request',
                });
            }
            return originalHandler
                .apply(this, arguments)
                .once('response', function (res) {
                if (breadcrumbsEnabled) {
                    addRequestBreadcrumb('response', requestUrl, this, res);
                }
                if (tracingEnabled && span) {
                    span.setHttpStatus(res.statusCode);
                    span.finish();
                }
            })
                .once('error', function () {
                if (breadcrumbsEnabled) {
                    addRequestBreadcrumb('error', requestUrl, this);
                }
                if (tracingEnabled && span) {
                    span.setHttpStatus(500);
                    span.finish();
                }
            });
        };
    };
}
/**
 * Captures Breadcrumb based on provided request/response pair
 */
function addRequestBreadcrumb(event, url, req, res) {
    if (!core_1.getCurrentHub().getIntegration(Http)) {
        return;
    }
    core_1.getCurrentHub().addBreadcrumb({
        category: 'http',
        data: {
            method: req.method,
            status_code: res && res.statusCode,
            url: url,
        },
        type: 'http',
    }, {
        event: event,
        request: req,
        response: res,
    });
}
/**
 * Function that can combine together a url that'll be used for our breadcrumbs.
 *
 * @param options url that should be returned or an object containing it's parts.
 * @returns constructed url
 */
function extractUrl(options) {
    if (typeof options === 'string') {
        return options;
    }
    var protocol = options.protocol || '';
    var hostname = options.hostname || options.host || '';
    // Don't log standard :80 (http) and :443 (https) ports to reduce the noise
    var port = !options.port || options.port === 80 || options.port === 443 ? '' : ":" + options.port;
    var path = options.path || '/';
    return protocol + "//" + hostname + port + path;
}
/**
 * Checks whether given url points to Sentry server
 * @param url url to verify
 */
function isSentryRequest(url) {
    var client = core_1.getCurrentHub().getClient();
    if (!url || !client) {
        return false;
    }
    var dsn = client.getDsn();
    if (!dsn) {
        return false;
    }
    return url.indexOf(dsn.host) !== -1;
}
//# sourceMappingURL=http.js.map