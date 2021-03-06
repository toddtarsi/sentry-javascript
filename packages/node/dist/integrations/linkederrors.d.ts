import { Event, EventHint, Exception, ExtendedError, Integration } from '@sentry/types';
/** Adds SDK info to an event. */
export declare class LinkedErrors implements Integration {
    /**
     * @inheritDoc
     */
    readonly name: string;
    /**
     * @inheritDoc
     */
    static id: string;
    /**
     * @inheritDoc
     */
    private readonly _key;
    /**
     * @inheritDoc
     */
    private readonly _limit;
    /**
     * @inheritDoc
     */
    constructor(options?: {
        key?: string;
        limit?: number;
    });
    /**
     * @inheritDoc
     */
    setupOnce(): void;
    /**
     * @inheritDoc
     */
    handler(event: Event, hint?: EventHint): PromiseLike<Event>;
    /**
     * @inheritDoc
     */
    walkErrorTree(error: ExtendedError, key: string, stack?: Exception[]): PromiseLike<Exception[]>;
}
//# sourceMappingURL=linkederrors.d.ts.map