import { EventProcessor, Hub, Integration } from '@sentry/types';
import { Application } from 'express';
/**
 * Express integration
 *
 * Provides an request and error handler for Express framework
 * as well as tracing capabilities
 */
export declare class Express implements Integration {
    /**
     * @inheritDoc
     */
    name: string;
    /**
     * @inheritDoc
     */
    static id: string;
    /**
     * Express App instance
     */
    private readonly _app?;
    /**
     * @inheritDoc
     */
    constructor(options?: {
        app?: Application;
    });
    /**
     * @inheritDoc
     */
    setupOnce(_addGlobalEventProcessor: (callback: EventProcessor) => void, getCurrentHub: () => Hub): void;
}
//# sourceMappingURL=express.d.ts.map