const NAMESPACE = "alo-pos-apps-lambda"; // Static namespace for the entire application


const hrtimeToMilliseconds = (hrtime) => {
    return hrtime[0] * 1e3 + hrtime[1] / 1e6;
  };
  
  const logMetric = (metricName, value, dimensions = {}) => {
    const metricData = {
      _aws: {
        Timestamp: Date.now(),
        CloudWatchMetrics: [
          {
            Namespace: NAMESPACE,
            Dimensions: [Object.keys(dimensions)],
            Metrics: [
              {
                Name: metricName,
                Unit: 'Milliseconds'
              }
            ]
          }
        ]
      },
      ...dimensions,
      [metricName]: value
    };
  
    console.log(JSON.stringify(metricData));
  };
  
  // Use the ES6 export feature
  export {
    logMetric,
    hrtimeToMilliseconds
  };
  