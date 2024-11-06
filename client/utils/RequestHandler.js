import { catchError } from './utils.js';

export default class RequestHandler {
    /**
     * Base URL for requests.
     * @private
     * @type {string}
     */
    baseURL = '';

    /**
     * Request headers.
     * @private
     * @type {Record<string, string>}
     */
    headers = {};

    /**
     * Creates an instance of RequestHandler.
     * @param {string} [baseURL=''] - The base URL to use for all requests. If no baseURL is provided, requests will be made using the provided endpoint URLs.
     */
    constructor(baseURL = '') {
        this.baseURL = baseURL;
        this.headers = {
            'Content-Type': 'application/json',
        };
    }

    /**
     * Sets a header value for requests.
     * @param {string} key - The name of the header.
     * @param {string} value - The value of the header.
     * @returns {this} - Support chainning method
     * @example
     * const requestHandler = new RequestHandler();
     * requestHandler.setHeader('Authorization', 'Bearer token')
     *               .setHeader('Header2', 'Second header');
     */
    setHeader(key, value) {
        this.headers[key] = value;
        return this;
    }

    /**
     * Clears a specific header from the headers object.
     * @param {string} key - The name of the header to remove.
     * @returns {this} Support chainning method
     * @example
     * requestUtils.clearHeader('Authorization')
     *             .clearHeader('Header2')
     */
    clearHeader(key) {
        delete this.headers[key];
        return this;
    }

    /**
     * Performs an HTTP request with the specified options.
     * @private
     * @param {string} url - The endpoint URL (relative or absolute).
     * @param {RequestInit} [options={}] - The options for the fetch request. These options may include method, body, headers, etc.
     * @returns {Promise<{ error: Error | undefined, result: any | undefined }>} A promise that resolves to an object containing the error (if any) and the result (if successful).
     * @throws {Error} If the request fails or the response is not ok.
     * @example
     * const { error, result } = await requestUtils.request('/api/data', { method: 'GET' });
     */
    async request(url, options = {}) {
        const finalUrl = this.baseURL ? `${this.baseURL}${url}` : url;
        return catchError(async () => {
            const response = await fetch(finalUrl, {
                ...options,
                headers: this.headers,
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.message || 'Request failed');
            }
            return data;
        });
    }

    /**
     * Performs a GET request.
     * @param {string} url - The endpoint URL.
     * @returns {Promise<{ error: Error | undefined, result: any | undefined }>} A promise that resolves to an object containing the error (if any) and the result (if successful).
     * @example
     * const { error, result } = await requestUtils.get('/api/data');
     */
    async get(url) {
        return this.request(url, {
            method: 'GET',
        });
    }

    /**
     * Performs a POST request.
     * @param {string} url - The endpoint URL.
     * @param {any} body - The body data to send in the request.
     * @returns {Promise<{ error: Error | undefined, result: any | undefined }>} A promise that resolves to an object containing the error (if any) and the result (if successful).
     * @example
     * const { error, result } = await requestUtils.post('/api/data', { key: 'value' });
     */
    async post(url, body) {
        return this.request(url, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    /**
     * Performs a PUT request.
     * @param {string} url - The endpoint URL.
     * @param {any} body - The body data to send in the request.
     * @returns {Promise<{ error: Error | undefined, result: any | undefined }>} A promise that resolves to an object containing the error (if any) and the result (if successful).
     * @example
     * const { error, result } = await requestUtils.put('/api/data', { key: 'updatedValue' });
     */
    async put(url, body) {
        return this.request(url, {
            method: 'PUT',
            body: JSON.stringify(body),
        });
    }

    /**
     * Performs a DELETE request.
     * @param {string} url - The endpoint URL.
     * @returns {Promise<{ error: Error | undefined, result: any | undefined }>} A promise that resolves to an object containing the error (if any) and the result (if successful).
     * @example
     * const { error, result } = await requestUtils.delete('/api/data');
     */
    async delete(url) {
        return this.request(url, {
            method: 'DELETE',
        });
    }
}