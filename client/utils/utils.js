/**
 * A utility function to catch errors from async functions with multiple parameters.
 * @template ReturnValue
 * @param {(params: any[]) => Promise<ReturnValue>} func - The async function to execute.
 * @param {any[]} params - The array of parameters to pass to the function.
 * @returns {Promise<{ error: Error | undefined, result: ReturnValue | undefined }>} An object containing the error or result.
 */
export async function catchError(func, params) {
    try {
        const result = await func(...params);
        return { error: undefined, result };
    } catch (error) {
        return { error: /** @type {Error} */ (error), result: undefined };
    }
};

/**
 * Memoizes a given function by caching its computed results.
 * @param {Function} fn - The function to memoize.
 * @returns {Function} - A new memoized version of the function.
 */
export function memoize(fn) {
    const cache = new Map();
    const objectCache = new WeakMap();

    /**
     * Generates a cache key based on the arguments.
     * @param {Array} args - The arguments provided to the function.
     * @returns {string|object} - A cache key which can be a string or an object.
     */
    function getCacheKey(args) {
        return (args.length === 1) ? args[0] : JSON.stringify(args);
    }

    return function(...args) {
        const key = getCacheKey(args);

        if (typeof key === 'object' && key !== null) {
            if (objectCache.has(key)) {
                console.log('from object cache');
                return objectCache.get(key);
            }
        } else {
            if (cache.has(key)) {
                console.log('from cache');
                return cache.get(key);
            }
        }

        let result;

        try {
            result = fn.apply(this, args);
        } catch (error) {
            throw error;
        }

        if (result instanceof Promise) {
            result = result.catch(error => {
                if (typeof key === 'object' && key !== null) {
                    objectCache.delete(key);
                } else {
                    cache.delete(key);
                }
                throw error;
            });
        }

        if (typeof key === 'object' && key !== null) {
            objectCache.set(key, result);
        } else {
            cache.set(key, result);
        }

        return result;
    };
}

/**
 * Creates a debounced version of the provided function.
 * @param {Function} func - The function to debounce.
 * @param {number} wait - The number of milliseconds to delay.
 * @param {boolean} [immediate=false] - Whether to execute the function immediately.
 * @returns {Function} - A debounced version of the provided function.
 */
export function debounce(func, wait, immediate = false) {
    let timeout;

    return function(...args) {
        const context = this;

        return new Promise((resolve, reject) => {
            const later = function() {
                timeout = null;
                if (!immediate) {
                    try {
                        const result = func.apply(context, args);
                        if (result instanceof Promise) {
                            result.then(resolve).catch(reject);
                        } else {
                            resolve(result);
                        }
                    } catch (error) {
                        reject(error);
                    }
                }
            };

            const callNow = immediate && !timeout;

            clearTimeout(timeout);
            timeout = setTimeout(later, wait);

            if (callNow) {
                try {
                    const result = func.apply(context, args);
                    if (result instanceof Promise) {
                        result.then(resolve).catch(reject);
                    } else {
                        resolve(result);
                    }
                } catch (error) {
                    reject(error);
                }
            }
        });
    };
}