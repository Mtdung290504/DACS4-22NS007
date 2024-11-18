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