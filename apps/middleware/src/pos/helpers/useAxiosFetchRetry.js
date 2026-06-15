import axios from 'axios';
import util from 'util';

const LOG_PREFIX = '--------------------------\nuseAxiosFetch :: ';
const CONNECT_TIMEOUT = 10000;
// Interceptor for connect timeout 
axios.interceptors.request.use((config) => {
  const source = axios.CancelToken.source();
  config.cancelToken = source.token;
  setTimeout(() => {
    source.cancel(`AXIOS Connection timed out after ${CONNECT_TIMEOUT}ms`);
  }, CONNECT_TIMEOUT);
  return config;
});
axios.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (axios.isCancel(error)) {
      return Promise.reject(new Error("AXIOS Connection timed out"));
    }
    return Promise.reject(error);
  }
);
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retryPromise = async (promiseFunc, numberOfTries = 1, { delay } = {}) => {
  try {
    return await promiseFunc(numberOfTries - 1);
  } catch (err) {
    if (numberOfTries <= 1) throw err;
    if (delay) await sleep(delay);
    return await retryPromise(promiseFunc, numberOfTries - 1, { delay });
  }
};

const fetchWithLogging = async (attemptNumber, resource, axiosOptions) => {
    console.log(util.format('%s Attempt %d :: Fetching URL: %s \nOptions: %s \n----------------------------',
        LOG_PREFIX, attemptNumber, resource, JSON.stringify(axiosOptions)));
        try {
          const response = await axios(axiosOptions);
          console.log(
              util.format(
                  '%s Response: %s -> Status: %d %s \n----------------------------',
                  LOG_PREFIX,
                  resource,
                  response.status,
                  response.statusText
              )
          );
          return response;
      } catch (error) {
          if (error.response) {
              // Request was made, but the server responded with a status code outside of 2xx
              console.error(
                  util.format(
                      '%s Error fetching URL: %s -> Error: %s \nStatus: %d \n----------------------------',
                      LOG_PREFIX,
                      resource,
                      error.message,
                      error.response.status
                  )
              );
          } else if (error.request) {
              // The request was made but no response was received
              console.error(util.format('%s Error fetching URL: %s -> Error: No response received \n----------------------------', LOG_PREFIX, resource));
          } else {
              // Something happened in setting up the request that triggered an error
              console.error(util.format('%s Error fetching URL: %s -> Error: %s \n----------------------------', LOG_PREFIX, resource, error.message));
          }
          throw error; // Rethrow the error after logging it
      }
};

const useAxiosFetch = async (resource, options, timeout = 5000, retries = 3, delay = 1000) => {
    const axiosOptions = {
        method: options.method || 'GET',
        url: resource,
        data: options.body ? JSON.parse(options.body) : undefined,
        headers: options.headers,
        timeout
    };

    return retryPromise((attemptNumber) => fetchWithLogging(attemptNumber, resource, axiosOptions), retries, { delay });
};

export default useAxiosFetch;
