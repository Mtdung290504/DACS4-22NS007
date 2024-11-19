/**
 * @typedef OriginalMethodType
 * @typedef {(...args: any[]) => OriginalMethodType} DecoratedMethod
 * @typedef {(originalMethod: (...args: any[]) => OriginalMethodType) => DecoratedMethod} Decorator
 */

/**
 * Áp dụng decorators cho các method được chỉ định trong class hoặc toàn bộ các method của class.
 * @template {new (...args: any[]) => any} Class
 * @param {Class} Class - Class cần áp dụng decorators.
 * @param {(keyof InstanceType<Class>)[] | 'ALL_METHOD'} methodNames - Danh sách tên method hoặc 'ALL_METHOD' để áp dụng lên toàn bộ.
 * @param {...Decorator} decorators - Các decorators cần áp dụng.
 */
export function applyMethodDecorators(Class, methodNames, ...decorators) {
    /**
     * Các decorator hợp lệ sau khi được lọc
     */
    const validDecorators = decorators.filter((decorator) => {
        if (typeof decorator === 'function') {
            return true;
        }
        console.warn(`-> From decorator manager: Decorator ignored:`, decorator, `is not a function.`);
        return false;
    });

    if (validDecorators.length === 0) {
        console.warn('-> From decorator manager: No valid decorators provided. Skipping application.');
        return;
    }

    /**
     * Danh sách tên các method được áp dụng decorator
     */
    const methodNameList =
        methodNames === 'ALL_METHOD'
            ? Object.getOwnPropertyNames(Class.prototype).filter((name) => typeof Class.prototype[name] === 'function')
            : methodNames;

    // Áp dụng decorators lên danh sách method
    methodNameList.forEach((methodName) => {
        const originalMethod = Class.prototype[methodName];

        if (typeof originalMethod !== 'function') {
            console.warn(`-> From decorator manager: Method ignored:`, methodName, `is not a valid function in class.`);
            return;
        }

        // Áp dụng từng decorator, giữ nguyên decorator cũ
        Class.prototype[methodName] = [noopDecorator, ...validDecorators].reduce((decorated, decorator) => {
            const wrappedFunction = decorator(decorated);

            // Lưu lại tên class và method
            const newName = originalMethod.name.split('.').includes(Class.name)
                ? originalMethod.name
                : `${Class.name}.${originalMethod.name}`;
            Object.defineProperty(wrappedFunction, 'name', {
                value: newName, configurable: true
            });
            return wrappedFunction;
        }, originalMethod);
    });

    console.log();

    /**
     * Decorator không làm gì cả, chỉ trả về phương thức gốc.
     * @type {Decorator}
     */
    function noopDecorator(originalMethod) {
        return function (...args) {
            return originalMethod.apply(this, args);
        };
    }
}

/**
 * Decorator yêu cầu implement abstract method
 * @type {Decorator}
 */
export function requireImplementMethod(originalMethod) {
    return function () {
        throw new Error(`'${originalMethod.name}' is not implement yet`);
    }
}

/**
 * Decorator viết log
 * @type {Decorator}
 */
export function logger(originalMethod) {
    return function (...args) {
        const log = (result, isAsync = false) => {
            console.log(`---> From logger: Calling ${isAsync ? 'async ' : ''}method:\t ${originalMethod.name}`);
            console.log(`---> From logger: Params:\t\t`, args);
            console.log(`---> From logger: Result:\t\t`, result, '\n');
            return result;
        }

        const result = originalMethod.apply(this, args);

        if (result instanceof Promise) {
            return result
                .then((res) => {
                    return log(res, true);
                })
                .catch((err) => {
                    console.log(`---> From logger: From '${originalMethod.name}', Caught error (async):\n`, err, '\n');
                    throw err;
                });
        }

        return log(result);
    };
}

/**
 * Decorator bắt lỗi
 * @type {Decorator}
 */
export function catchError(originalMethod) {
    return function (...args) {
        try {
            const result = originalMethod.apply(this, args);

            if (result instanceof Promise) {
                return result.catch((error) => {
                    console.error(`---> From catchError: Error in async method '${originalMethod.name}':`, error);
                    return 'err-from-catch-error';
                });
            }

            return result;
        } catch (error) {
            console.error(`---> From catchError: Error in method '${originalMethod.name}':`, error);
            return 'err-from-catch-error';
        }
    };
}

/**
 * Decorator tạo khả năng `cache` cho function (kể cả async function)
 * @type {Decorator}
 */
export function memoize(originalFunction) {
    const cache = new Map();
    const objectCache = new WeakMap();

    /**
     * Tạo cache key dựa vào các tham số.
     * @param {Array} args - Mảng các tham số.
     * @returns {string|object} - Một cache key là string hoặc object.
     */
    function getCacheKey(args) {
        return (args.length === 1) ? args[0] : JSON.stringify(args);
    }

    return function (...args) {
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
            result = originalFunction.apply(this, args);
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
 * Decorator tạo khả năng debounce cho function
 * @type {Decorator}
 */
export function debounce(originalFunction) {
    let timeout;
    const wait = 250;
    const immediate = false

    return function (...args) {
        const context = this;

        return new Promise((resolve, reject) => {
            const later = function () {
                timeout = null;
                if (!immediate) {
                    try {
                        const result = originalFunction.apply(context, args);
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
                    const result = originalFunction.apply(context, args);
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