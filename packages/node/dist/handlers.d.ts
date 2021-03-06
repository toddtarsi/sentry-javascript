/// <reference types="node" />
import { Event } from '@sentry/types';
import * as http from 'http';
/**
 * Express compatible tracing handler.
 * @see Exposed as `Handlers.tracingHandler`
 */
export declare function tracingHandler(): (req: http.IncomingMessage, res: http.ServerResponse, next: (error?: any) => void) => void;
declare type TransactionTypes = 'path' | 'methodPath' | 'handler';
/**
 * Options deciding what parts of the request to use when enhancing an event
 */
interface ParseRequestOptions {
    request?: boolean | string[];
    serverName?: boolean;
    transaction?: boolean | TransactionTypes;
    user?: boolean | string[];
    version?: boolean;
}
/**
 * Enriches passed event with request data.
 *
 * @param event Will be mutated and enriched with req data
 * @param req Request object
 * @param options object containing flags to enable functionality
 * @hidden
 */
export declare function parseRequest(event: Event, req: {
    [key: string]: any;
}, options?: ParseRequestOptions): Event;
/**
 * Express compatible request handler.
 * @see Exposed as `Handlers.requestHandler`
 */
export declare function requestHandler(options?: ParseRequestOptions & {
    flushTimeout?: number;
}): (req: http.IncomingMessage, res: http.ServerResponse, next: (error?: any) => void) => void;
/** JSDoc */
interface MiddlewareError extends Error {
    status?: number | string;
    statusCode?: number | string;
    status_code?: number | string;
    output?: {
        statusCode?: number | string;
    };
}
/**
 * Express compatible error handler.
 * @see Exposed as `Handlers.errorHandler`
 */
export declare function errorHandler(options?: {
    /**
     * Callback method deciding whether error should be captured and sent to Sentry
     * @param error Captured middleware error
     */
    shouldHandleError?(error: MiddlewareError): boolean;
}): (error: MiddlewareError, req: http.IncomingMessage, res: http.ServerResponse, next: (error: MiddlewareError) => void) => void;
/**
 * @hidden
 */
export declare function logAndExitProcess(error: Error): void;
export {};
//# sourceMappingURL=handlers.d.ts.map