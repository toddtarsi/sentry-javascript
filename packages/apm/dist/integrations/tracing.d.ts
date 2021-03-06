import { EventProcessor, Hub, Integration, Span, SpanContext, SpanStatus } from '@sentry/types';
/**
 * Options for Tracing integration
 */
interface TracingOptions {
    /**
     * List of strings / regex where the integration should create Spans out of. Additionally this will be used
     * to define which outgoing requests the `sentry-trace` header will be attached to.
     *
     * Default: ['localhost', /^\//]
     */
    tracingOrigins: Array<string | RegExp>;
    /**
     * Flag to disable patching all together for fetch requests.
     *
     * Default: true
     */
    traceFetch: boolean;
    /**
     * Flag to disable patching all together for xhr requests.
     *
     * Default: true
     */
    traceXHR: boolean;
    /**
     * This function will be called before creating a span for a request with the given url.
     * Return false if you don't want a span for the given url.
     *
     * By default it uses the `tracingOrigins` options as a url match.
     */
    shouldCreateSpanForRequest(url: string): boolean;
    /**
     * The time to wait in ms until the transaction will be finished. The transaction will use the end timestamp of
     * the last finished span as the endtime for the transaction.
     * Time is in ms.
     *
     * Default: 500
     */
    idleTimeout: number;
    /**
     * Flag to enable/disable creation of `navigation` transaction on history changes. Useful for react applications with
     * a router.
     *
     * Default: true
     */
    startTransactionOnLocationChange: boolean;
    /**
     * Sample to determine if the Integration should instrument anything. The decision will be taken once per load
     * on initalization.
     * 0 = 0% chance of instrumenting
     * 1 = 100% change of instrumenting
     *
     * Default: 1
     */
    tracesSampleRate: number;
    /**
     * The maximum duration of a transaction before it will be discarded. This is for some edge cases where a browser
     * completely freezes the JS state and picks it up later (background tabs).
     * So after this duration, the SDK will not send the event.
     * If you want to have an unlimited duration set it to 0.
     * Time is in seconds.
     *
     * Default: 600
     */
    maxTransactionDuration: number;
}
/** JSDoc */
interface Activity {
    name: string;
    span?: Span;
}
/**
 * Tracing Integration
 */
export declare class Tracing implements Integration {
    private readonly _options?;
    /**
     * @inheritDoc
     */
    name: string;
    /**
     * @inheritDoc
     */
    static id: string;
    /**
     * Is Tracing enabled, this will be determined once per pageload.
     */
    private static _enabled?;
    /** JSDoc */
    static options: TracingOptions;
    /**
     * Returns current hub.
     */
    private static _getCurrentHub?;
    private static _activeTransaction?;
    private static _currentIndex;
    static readonly _activities: {
        [key: number]: Activity;
    };
    private static _debounce;
    private readonly _emitOptionsWarning;
    /**
     * Constructor for Tracing
     *
     * @param _options TracingOptions
     */
    constructor(_options?: Partial<TracingOptions> | undefined);
    /**
     * @inheritDoc
     */
    setupOnce(addGlobalEventProcessor: (callback: EventProcessor) => void, getCurrentHub: () => Hub): void;
    /**
     * Is tracing enabled
     */
    private static _isEnabled;
    /**
     * Starts a Transaction waiting for activity idle to finish
     */
    static startIdleTransaction(name: string, spanContext?: SpanContext): Span | undefined;
    /**
     * Update transaction
     * @deprecated
     */
    static updateTransactionName(name: string): void;
    /**
     * Finshes the current active transaction
     */
    static finishIdleTransaction(): void;
    /**
     * Sets the status of the current active transaction (if there is one)
     */
    static setTransactionStatus(status: SpanStatus): void;
    /**
     * Starts tracking for a specifc activity
     */
    static pushActivity(name: string, spanContext?: SpanContext): number;
    /**
     * Removes activity and finishes the span in case there is one
     */
    static popActivity(id: number, spanData?: {
        [key: string]: any;
    }): void;
}
export {};
//# sourceMappingURL=tracing.d.ts.map