// tslint:disable:max-classes-per-file
Object.defineProperty(exports, "__esModule", { value: true });
var tslib_1 = require("tslib");
var hub_1 = require("@sentry/hub");
var types_1 = require("@sentry/types");
var utils_1 = require("@sentry/utils");
// TODO: Should this be exported?
exports.TRACEPARENT_REGEXP = new RegExp('^[ \\t]*' + // whitespace
    '([0-9a-f]{32})?' + // trace_id
    '-?([0-9a-f]{16})?' + // span_id
    '-?([01])?' + // sampled
    '[ \\t]*$');
/**
 * Keeps track of finished spans for a given transaction
 */
var SpanRecorder = /** @class */ (function () {
    function SpanRecorder(maxlen) {
        this._openSpanCount = 0;
        this.finishedSpans = [];
        this._maxlen = maxlen;
    }
    /**
     * This is just so that we don't run out of memory while recording a lot
     * of spans. At some point we just stop and flush out the start of the
     * trace tree (i.e.the first n spans with the smallest
     * start_timestamp).
     */
    SpanRecorder.prototype.startSpan = function (span) {
        this._openSpanCount += 1;
        if (this._openSpanCount > this._maxlen) {
            span.spanRecorder = undefined;
        }
    };
    /**
     * Appends a span to finished spans table
     * @param span Span to be added
     */
    SpanRecorder.prototype.finishSpan = function (span) {
        this.finishedSpans.push(span);
    };
    return SpanRecorder;
}());
/**
 * Span contains all data about a span
 */
var Span = /** @class */ (function () {
    function Span(spanContext, hub) {
        /**
         * The reference to the current hub.
         */
        this._hub = hub_1.getCurrentHub();
        /**
         * @inheritDoc
         */
        this._traceId = utils_1.uuid4();
        /**
         * @inheritDoc
         */
        this._spanId = utils_1.uuid4().substring(16);
        /**
         * Timestamp when the span was created.
         */
        this.startTimestamp = utils_1.timestampWithMs();
        /**
         * @inheritDoc
         */
        this.tags = {};
        /**
         * @inheritDoc
         */
        this.data = {};
        if (utils_1.isInstanceOf(hub, hub_1.Hub)) {
            this._hub = hub;
        }
        if (!spanContext) {
            return this;
        }
        if (spanContext.traceId) {
            this._traceId = spanContext.traceId;
        }
        if (spanContext.spanId) {
            this._spanId = spanContext.spanId;
        }
        if (spanContext.parentSpanId) {
            this._parentSpanId = spanContext.parentSpanId;
        }
        // We want to include booleans as well here
        if ('sampled' in spanContext) {
            this.sampled = spanContext.sampled;
        }
        if (spanContext.transaction) {
            this.transaction = spanContext.transaction;
        }
        if (spanContext.op) {
            this.op = spanContext.op;
        }
        if (spanContext.description) {
            this.description = spanContext.description;
        }
        if (spanContext.data) {
            this.data = spanContext.data;
        }
        if (spanContext.tags) {
            this.tags = spanContext.tags;
        }
    }
    /**
     * Attaches SpanRecorder to the span itself
     * @param maxlen maximum number of spans that can be recorded
     */
    Span.prototype.initFinishedSpans = function (maxlen) {
        if (maxlen === void 0) { maxlen = 1000; }
        if (!this.spanRecorder) {
            this.spanRecorder = new SpanRecorder(maxlen);
        }
        this.spanRecorder.startSpan(this);
    };
    /**
     * Creates a new `Span` while setting the current `Span.id` as `parentSpanId`.
     * Also the `sampled` decision will be inherited.
     */
    Span.prototype.child = function (spanContext) {
        var span = new Span(tslib_1.__assign({}, spanContext, { parentSpanId: this._spanId, sampled: this.sampled, traceId: this._traceId }));
        span.spanRecorder = this.spanRecorder;
        return span;
    };
    /**
     * Continues a trace from a string (usually the header).
     * @param traceparent Traceparent string
     */
    Span.fromTraceparent = function (traceparent, spanContext) {
        var matches = traceparent.match(exports.TRACEPARENT_REGEXP);
        if (matches) {
            var sampled = void 0;
            if (matches[3] === '1') {
                sampled = true;
            }
            else if (matches[3] === '0') {
                sampled = false;
            }
            return new Span(tslib_1.__assign({}, spanContext, { parentSpanId: matches[2], sampled: sampled, traceId: matches[1] }));
        }
        return undefined;
    };
    /**
     * @inheritDoc
     */
    Span.prototype.setTag = function (key, value) {
        var _a;
        this.tags = tslib_1.__assign({}, this.tags, (_a = {}, _a[key] = value, _a));
        return this;
    };
    /**
     * @inheritDoc
     */
    Span.prototype.setData = function (key, value) {
        var _a;
        this.data = tslib_1.__assign({}, this.data, (_a = {}, _a[key] = value, _a));
        return this;
    };
    /**
     * @inheritDoc
     */
    Span.prototype.setStatus = function (value) {
        this.setTag('status', value);
        return this;
    };
    /**
     * @inheritDoc
     */
    Span.prototype.setHttpStatus = function (httpStatus) {
        this.setTag('http.status_code', String(httpStatus));
        var spanStatus = types_1.SpanStatus.fromHttpCode(httpStatus);
        if (spanStatus !== types_1.SpanStatus.UnknownError) {
            this.setStatus(spanStatus);
        }
        return this;
    };
    /**
     * @inheritDoc
     */
    Span.prototype.isSuccess = function () {
        return this.tags.status === types_1.SpanStatus.Ok;
    };
    /**
     * Sets the finish timestamp on the current span
     */
    Span.prototype.finish = function (useLastSpanTimestamp) {
        var _this = this;
        if (useLastSpanTimestamp === void 0) { useLastSpanTimestamp = false; }
        // This transaction is already finished, so we should not flush it again.
        if (this.timestamp !== undefined) {
            return undefined;
        }
        this.timestamp = utils_1.timestampWithMs();
        if (this.spanRecorder === undefined) {
            return undefined;
        }
        this.spanRecorder.finishSpan(this);
        if (this.transaction === undefined) {
            // If this has no transaction set we assume there's a parent
            // transaction for this span that would be flushed out eventually.
            return undefined;
        }
        if (this.sampled === undefined) {
            // At this point a `sampled === undefined` should have already been
            // resolved to a concrete decision. If `sampled` is `undefined`, it's
            // likely that somebody used `Sentry.startSpan(...)` on a
            // non-transaction span and later decided to make it a transaction.
            utils_1.logger.warn('Discarding transaction Span without sampling decision');
            return undefined;
        }
        var finishedSpans = this.spanRecorder ? this.spanRecorder.finishedSpans.filter(function (s) { return s !== _this; }) : [];
        if (useLastSpanTimestamp && finishedSpans.length > 0) {
            this.timestamp = finishedSpans[finishedSpans.length - 1].timestamp;
        }
        return this._hub.captureEvent({
            contexts: {
                trace: this.getTraceContext(),
            },
            spans: finishedSpans,
            start_timestamp: this.startTimestamp,
            tags: this.tags,
            timestamp: this.timestamp,
            transaction: this.transaction,
            type: 'transaction',
        });
    };
    /**
     * @inheritDoc
     */
    Span.prototype.toTraceparent = function () {
        var sampledString = '';
        if (this.sampled !== undefined) {
            sampledString = this.sampled ? '-1' : '-0';
        }
        return this._traceId + "-" + this._spanId + sampledString;
    };
    /**
     * @inheritDoc
     */
    Span.prototype.getTraceContext = function () {
        return utils_1.dropUndefinedKeys({
            data: this.data,
            description: this.description,
            op: this.op,
            parent_span_id: this._parentSpanId,
            span_id: this._spanId,
            status: this.tags.status,
            tags: this.tags,
            trace_id: this._traceId,
        });
    };
    /**
     * @inheritDoc
     */
    Span.prototype.toJSON = function () {
        return utils_1.dropUndefinedKeys({
            data: this.data,
            description: this.description,
            op: this.op,
            parent_span_id: this._parentSpanId,
            sampled: this.sampled,
            span_id: this._spanId,
            start_timestamp: this.startTimestamp,
            tags: this.tags,
            timestamp: this.timestamp,
            trace_id: this._traceId,
            transaction: this.transaction,
        });
    };
    return Span;
}());
exports.Span = Span;
//# sourceMappingURL=span.js.map