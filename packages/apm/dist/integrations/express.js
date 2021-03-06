Object.defineProperty(exports, "__esModule", { value: true });
var utils_1 = require("@sentry/utils");
/**
 * Express integration
 *
 * Provides an request and error handler for Express framework
 * as well as tracing capabilities
 */
var Express = /** @class */ (function () {
    /**
     * @inheritDoc
     */
    function Express(options) {
        if (options === void 0) { options = {}; }
        /**
         * @inheritDoc
         */
        this.name = Express.id;
        this._app = options.app;
    }
    /**
     * @inheritDoc
     */
    Express.prototype.setupOnce = function (_addGlobalEventProcessor, getCurrentHub) {
        if (!this._app) {
            utils_1.logger.error('ExpressIntegration is missing an Express instance');
            return;
        }
        instrumentMiddlewares(this._app, getCurrentHub);
    };
    /**
     * @inheritDoc
     */
    Express.id = 'Express';
    return Express;
}());
exports.Express = Express;
/**
 * Wraps original middleware function in a tracing call, which stores the info about the call as a span,
 * and finishes it once the middleware is done invoking.
 *
 * Express middlewares have 3 various forms, thus we have to take care of all of them:
 * // sync
 * app.use(function (req, res) { ... })
 * // async
 * app.use(function (req, res, next) { ... })
 * // error handler
 * app.use(function (err, req, res, next) { ... })
 */
function wrap(fn, getCurrentHub) {
    var arrity = fn.length;
    switch (arrity) {
        case 2: {
            return function (_req, res) {
                var span = getCurrentHub().startSpan({
                    description: fn.name,
                    op: 'middleware',
                });
                res.once('finish', function () { return span.finish(); });
                return fn.apply(this, arguments);
            };
        }
        case 3: {
            return function (req, res, next) {
                var span = getCurrentHub().startSpan({
                    description: fn.name,
                    op: 'middleware',
                });
                fn.call(this, req, res, function () {
                    span.finish();
                    return next.apply(this, arguments);
                });
            };
        }
        case 4: {
            return function (err, req, res, next) {
                var span = getCurrentHub().startSpan({
                    description: fn.name,
                    op: 'middleware',
                });
                fn.call(this, err, req, res, function () {
                    span.finish();
                    return next.apply(this, arguments);
                });
            };
        }
        default: {
            throw new Error("Express middleware takes 2-4 arguments. Got: " + arrity);
        }
    }
}
/**
 * Takes all the function arguments passed to the original `app.use` call
 * and wraps every function, as well as array of functions with a call to our `wrap` method.
 * We have to take care of the arrays as well as iterate over all of the arguments,
 * as `app.use` can accept middlewares in few various forms.
 *
 * app.use([<path>], <fn>)
 * app.use([<path>], <fn>, ...<fn>)
 * app.use([<path>], ...<fn>[])
 */
function wrapUseArgs(args, getCurrentHub) {
    return Array.from(args).map(function (arg) {
        if (typeof arg === 'function') {
            return wrap(arg, getCurrentHub);
        }
        if (Array.isArray(arg)) {
            return arg.map(function (a) {
                if (typeof a === 'function') {
                    return wrap(a, getCurrentHub);
                }
                return a;
            });
        }
        return arg;
    });
}
/**
 * Patches original app.use to utilize our tracing functionality
 */
function instrumentMiddlewares(app, getCurrentHub) {
    var originalAppUse = app.use;
    app.use = function () {
        return originalAppUse.apply(this, wrapUseArgs(arguments, getCurrentHub));
    };
    return app;
}
//# sourceMappingURL=express.js.map