Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var apm_1 = require("@sentry/apm");
var core_1 = require("@sentry/core");
var utils_1 = require("@sentry/utils");
var cookie = require("cookie");
var domain = require("domain");
var os = require("os");
var url = require("url");
var sdk_1 = require("./sdk");
var DEFAULT_SHUTDOWN_TIMEOUT = 2000;
/**
 * Express compatible tracing handler.
 * @see Exposed as `Handlers.tracingHandler`
 */
function tracingHandler() {
    return function sentryTracingMiddleware(req, res, next) {
        // TODO: At this point req.route.path we use in `extractTransaction` is not available
        // but `req.path` or `req.url` should do the job as well. We could unify this here.
        var reqMethod = (req.method || '').toUpperCase();
        var reqUrl = req.url;
        var hub = core_1.getCurrentHub();
        var transaction = hub.startSpan({
            transaction: reqMethod + "|" + reqUrl,
        });
        hub.configureScope(function (scope) {
            scope.setSpan(transaction);
        });
        res.once('finish', function () {
            transaction.setHttpStatus(res.statusCode);
            transaction.finish();
        });
        next();
    };
}
exports.tracingHandler = tracingHandler;
/** JSDoc */
function extractTransaction(req, type) {
    try {
        // Express.js shape
        var request = req;
        switch (type) {
            case 'path': {
                return request.route.path;
            }
            case 'handler': {
                return request.route.stack[0].name;
            }
            case 'methodPath':
            default: {
                var method = request.method.toUpperCase();
                var path = request.route.path;
                return method + "|" + path;
            }
        }
    }
    catch (_oO) {
        return undefined;
    }
}
/** Default request keys that'll be used to extract data from the request */
var DEFAULT_REQUEST_KEYS = ['cookies', 'data', 'headers', 'method', 'query_string', 'url'];
/** JSDoc */
function extractRequestData(req, keys) {
    var request = {};
    var attributes = Array.isArray(keys) ? keys : DEFAULT_REQUEST_KEYS;
    // headers:
    //   node, express: req.headers
    //   koa: req.header
    var headers = (req.headers || req.header || {});
    // method:
    //   node, express, koa: req.method
    var method = req.method;
    // host:
    //   express: req.hostname in > 4 and req.host in < 4
    //   koa: req.host
    //   node: req.headers.host
    var host = req.hostname || req.host || headers.host || '<no host>';
    // protocol:
    //   node: <n/a>
    //   express, koa: req.protocol
    var protocol = req.protocol === 'https' || req.secure || (req.socket || {}).encrypted
        ? 'https'
        : 'http';
    // url (including path and query string):
    //   node, express: req.originalUrl
    //   koa: req.url
    var originalUrl = (req.originalUrl || req.url);
    // absolute url
    var absoluteUrl = protocol + "://" + host + originalUrl;
    attributes.forEach(function (key) {
        switch (key) {
            case 'headers':
                request.headers = headers;
                break;
            case 'method':
                request.method = method;
                break;
            case 'url':
                request.url = absoluteUrl;
                break;
            case 'cookies':
                // cookies:
                //   node, express, koa: req.headers.cookie
                request.cookies = cookie.parse(headers.cookie || '');
                break;
            case 'query_string':
                // query string:
                //   node: req.url (raw)
                //   express, koa: req.query
                request.query_string = url.parse(originalUrl || '', false).query;
                break;
            case 'data':
                // body data:
                //   node, express, koa: req.body
                var data = req.body;
                if (method === 'GET' || method === 'HEAD') {
                    if (typeof data === 'undefined') {
                        data = '<unavailable>';
                    }
                }
                if (data && !utils_1.isString(data)) {
                    // Make sure the request body is a string
                    data = JSON.stringify(utils_1.normalize(data));
                }
                request.data = data;
                break;
            default:
                if ({}.hasOwnProperty.call(req, key)) {
                    request[key] = req[key];
                }
        }
    });
    return request;
}
/** Default user keys that'll be used to extract data from the request */
var DEFAULT_USER_KEYS = ['id', 'username', 'email'];
/** JSDoc */
function extractUserData(req, keys) {
    var user = {};
    var attributes = Array.isArray(keys) ? keys : DEFAULT_USER_KEYS;
    attributes.forEach(function (key) {
        if (req.user && key in req.user) {
            user[key] = req.user[key];
        }
    });
    // client ip:
    //   node: req.connection.remoteAddress
    //   express, koa: req.ip
    var ip = req.ip || (req.connection && req.connection.remoteAddress);
    if (ip) {
        user.ip_address = ip;
    }
    return user;
}
/**
 * Enriches passed event with request data.
 *
 * @param event Will be mutated and enriched with req data
 * @param req Request object
 * @param options object containing flags to enable functionality
 * @hidden
 */
function parseRequest(event, req, options) {
    // tslint:disable-next-line:no-parameter-reassignment
    options = tslib_1.__assign({ request: true, serverName: true, transaction: true, user: true, version: true }, options);
    if (options.version) {
        event.extra = tslib_1.__assign({}, event.extra, { node: global.process.version });
    }
    if (options.request) {
        event.request = tslib_1.__assign({}, event.request, extractRequestData(req, options.request));
    }
    if (options.serverName) {
        event.server_name = global.process.env.SENTRY_NAME || os.hostname();
    }
    if (options.user && req.user) {
        event.user = tslib_1.__assign({}, event.user, extractUserData(req, options.user));
    }
    if (options.transaction && !event.transaction) {
        var transaction = extractTransaction(req, options.transaction);
        if (transaction) {
            event.transaction = transaction;
        }
    }
    return event;
}
exports.parseRequest = parseRequest;
/**
 * Express compatible request handler.
 * @see Exposed as `Handlers.requestHandler`
 */
function requestHandler(options) {
    return function sentryRequestMiddleware(req, res, next) {
        if (options && options.flushTimeout && options.flushTimeout > 0) {
            // tslint:disable-next-line: no-unbound-method
            var _end_1 = res.end;
            res.end = function (chunk, encoding, cb) {
                var _this = this;
                sdk_1.flush(options.flushTimeout)
                    .then(function () {
                    _end_1.call(_this, chunk, encoding, cb);
                })
                    .then(null, function (e) {
                    utils_1.logger.error(e);
                });
            };
        }
        var local = domain.create();
        local.add(req);
        local.add(res);
        local.on('error', next);
        local.run(function () {
            core_1.getCurrentHub().configureScope(function (scope) {
                return scope.addEventProcessor(function (event) { return parseRequest(event, req, options); });
            });
            next();
        });
    };
}
exports.requestHandler = requestHandler;
/** JSDoc */
function getStatusCodeFromResponse(error) {
    var statusCode = error.status || error.statusCode || error.status_code || (error.output && error.output.statusCode);
    return statusCode ? parseInt(statusCode, 10) : 500;
}
/** Returns true if response code is internal server error */
function defaultShouldHandleError(error) {
    var status = getStatusCodeFromResponse(error);
    return status >= 500;
}
/**
 * Express compatible error handler.
 * @see Exposed as `Handlers.errorHandler`
 */
function errorHandler(options) {
    return function sentryErrorMiddleware(error, req, res, next) {
        var shouldHandleError = (options && options.shouldHandleError) || defaultShouldHandleError;
        if (shouldHandleError(error)) {
            core_1.withScope(function (scope) {
                if (req.headers && utils_1.isString(req.headers['sentry-trace'])) {
                    var span = apm_1.Span.fromTraceparent(req.headers['sentry-trace']);
                    scope.setSpan(span);
                }
                var eventId = core_1.captureException(error);
                res.sentry = eventId;
                next(error);
            });
            return;
        }
        next(error);
    };
}
exports.errorHandler = errorHandler;
/**
 * @hidden
 */
function logAndExitProcess(error) {
    console.error(error && error.stack ? error.stack : error);
    var client = core_1.getCurrentHub().getClient();
    if (client === undefined) {
        utils_1.logger.warn('No NodeClient was defined, we are exiting the process now.');
        global.process.exit(1);
        return;
    }
    var options = client.getOptions();
    var timeout = (options && options.shutdownTimeout && options.shutdownTimeout > 0 && options.shutdownTimeout) ||
        DEFAULT_SHUTDOWN_TIMEOUT;
    utils_1.forget(client.close(timeout).then(function (result) {
        if (!result) {
            utils_1.logger.warn('We reached the timeout for emptying the request buffer, still exiting now!');
        }
        global.process.exit(1);
    }));
}
exports.logAndExitProcess = logAndExitProcess;
//# sourceMappingURL=handlers.js.map