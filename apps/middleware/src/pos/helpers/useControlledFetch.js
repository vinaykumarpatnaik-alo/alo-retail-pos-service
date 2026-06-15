import fetch from "node-fetch";
import util from 'util';

const LOG_PREFIX = '--------------------------\nuseControlledFetch :: ';

/**
 * A fetch wrapper with a timeout option and logging
 * @param {string} resource - The URL to fetch
 * @param {object} options - The options object for fetch
 * @param {number} [timeout=5000] - Timeout in milliseconds
 * @returns {Promise<Response>}
 */
async function useControlledFetch(resource, options, timeout = 5000) {
    // Create an AbortController instance and its signal
    const controller = new AbortController();
    const { signal } = controller;

    // Set up a timeout for aborting the fetch request
    const timer = setTimeout(() => {
        controller.abort();
    }, timeout);

    try {
        console.log(util.format('%s Fetching URL: %s \n Options: %s \n----------------------------',
            LOG_PREFIX, resource, JSON.stringify(options)));

        const response = await fetch(resource, { ...options, signal });

        clearTimeout(timer);

        console.log(util.format('%s Fetching URL: %s -> Status: %d %s \n----------------------------',
            LOG_PREFIX, resource, response.status, response.statusText));

        return response;
    } catch (error) {
        console.error("[USE_CTRL_FETCH_ERROR] ",error);
        if (error.name === 'AbortError') {
            throw new Error(`Request timed out after ${timeout} milliseconds`);
        }
        throw error;
    }
}

const DEFAULT_API_TIMEOUT = parseInt(process.env.DEFAULT_API_TIMEOUT, 10) || 10000;  // 10 (meaning decimal) and 10000 mills

export function useControlledAloApiFetch(resource, options = {}, timeout = DEFAULT_API_TIMEOUT) {
    return useControlledFetch(
        resource,
        {
            ...options,
            headers: {
                ...options.headers,
                'alo-sales-channel': 'pos',
                'User-Agent': 'AloPos/1.0.0/alo-pos-apps',
            },
        },
        timeout,
    );
}

export default useControlledFetch;
