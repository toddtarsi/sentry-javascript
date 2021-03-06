Object.defineProperty(exports, "__esModule", { value: true });
var hub_1 = require("@sentry/hub");
var utils_1 = require("@sentry/utils");
var span_1 = require("./span");
/**
 * Checks whether given value is instance of Span
 * @param span value to check
 */
function isSpanInstance(span) {
    return utils_1.isInstanceOf(span, span_1.Span);
}
/** Returns all trace headers that are currently on the top scope. */
function traceHeaders() {
    // @ts-ignore
    var that = this;
    var scope = that.getScope();
    if (scope) {
        var span = scope.getSpan();
        if (span) {
            return {
                'sentry-trace': span.toTraceparent(),
            };
        }
    }
    return {};
}
/**
 * This functions starts a span. If argument passed is of type `Span`, it'll run sampling on it if configured
 * and attach a `SpanRecorder`. If it's of type `SpanContext` and there is already a `Span` on the Scope,
 * the created Span will have a reference to it and become it's child. Otherwise it'll crete a new `Span`.
 *
 * @param span Already constructed span which should be started or properties with which the span should be created
 */
function startSpan(spanOrSpanContext, forceNoChild) {
    if (forceNoChild === void 0) { forceNoChild = false; }
    // @ts-ignore
    var that = this;
    var scope = that.getScope();
    var client = that.getClient();
    var span;
    if (!isSpanInstance(spanOrSpanContext) && !forceNoChild) {
        if (scope) {
            var parentSpan = scope.getSpan();
            if (parentSpan) {
                span = parentSpan.child(spanOrSpanContext);
            }
        }
    }
    if (!isSpanInstance(span)) {
        span = new span_1.Span(spanOrSpanContext, that);
    }
    if (span.sampled === undefined && span.transaction !== undefined) {
        var sampleRate = (client && client.getOptions().tracesSampleRate) || 0;
        span.sampled = Math.random() < sampleRate;
    }
    if (span.sampled) {
        var experimentsOptions = (client && client.getOptions()._experiments) || {};
        span.initFinishedSpans(experimentsOptions.maxSpans);
    }
    return span;
}
/**
 * This patches the global object and injects the APM extensions methods
 */
function addExtensionMethods() {
    var carrier = hub_1.getMainCarrier();
    if (carrier.__SENTRY__) {
        carrier.__SENTRY__.extensions = carrier.__SENTRY__.extensions || {};
        if (!carrier.__SENTRY__.extensions.startSpan) {
            carrier.__SENTRY__.extensions.startSpan = startSpan;
        }
        if (!carrier.__SENTRY__.extensions.traceHeaders) {
            carrier.__SENTRY__.extensions.traceHeaders = traceHeaders;
        }
    }
}
exports.addExtensionMethods = addExtensionMethods;
//# sourceMappingURL=hubextensions.js.map