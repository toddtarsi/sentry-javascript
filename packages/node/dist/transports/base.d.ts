/// <reference types="node" />
import { API } from '@sentry/core';
import { Event, Response, Transport, TransportOptions } from '@sentry/types';
import { PromiseBuffer } from '@sentry/utils';
import * as http from 'http';
import * as https from 'https';
import * as url from 'url';
/**
 * Internal used interface for typescript.
 * @hidden
 */
export interface HTTPRequest {
    /**
     * Request wrapper
     * @param options These are {@see TransportOptions}
     * @param callback Callback when request is finished
     */
    request(options: http.RequestOptions | https.RequestOptions | string | url.URL, callback?: (res: http.IncomingMessage) => void): http.ClientRequest;
}
/** Base Transport class implementation */
export declare abstract class BaseTransport implements Transport {
    options: TransportOptions;
    /** API object */
    protected _api: API;
    /** The Agent used for corresponding transport */
    module?: HTTPRequest;
    /** The Agent used for corresponding transport */
    client?: http.Agent | https.Agent;
    /** A simple buffer holding all requests. */
    protected readonly _buffer: PromiseBuffer<Response>;
    /** Locks transport after receiving 429 response */
    private _disabledUntil;
    /** Create instance and set this.dsn */
    constructor(options: TransportOptions);
    /** Returns a build request option object used by request */
    protected _getRequestOptions(): http.RequestOptions | https.RequestOptions;
    /** JSDoc */
    protected _sendWithModule(httpModule: HTTPRequest, event: Event): Promise<Response>;
    /**
     * @inheritDoc
     */
    sendEvent(_: Event): PromiseLike<Response>;
    /**
     * @inheritDoc
     */
    close(timeout?: number): PromiseLike<boolean>;
}
//# sourceMappingURL=base.d.ts.map