import { initLogger, MetricsTracker, runInContext, consoleMetrics } from "../mod.ts";

const metrics = new MetricsTracker(
  ["processedCount"],
  { metricFor: "testLoggerApp" },
);

// Function to generate random log messages
function generateRandomMessage() {
  const messages = [
    "Processing request",
    "User authenticated",
    "Error fetching data",
    "Warning: Deprecated API",
    "System load is high",
    "Debugging session started",
    "Trace network activity",
    "Operation successful",
    "Failed to connect to the database",
    "Log entry created",
  ];

  // Pick a random message
  const randomIndex = Math.floor(Math.random() * messages.length);
  return messages[randomIndex];
}

// Function to generate a random data object
function generateRandomDataObject() {
  return {
    userId: Math.floor(Math.random() * 10000),
    timestamp: new Date().toISOString(),
    operation: generateRandomMessage(),
    success: Math.random() > 0.5,
    value: Math.random() * 100,
  };
}

const dataObject = generateRandomDataObject();
let count = 0;

// Main function to generate logs
function generateLogs(iterations: number) {
  for (let i = 0; i < iterations; i++) {
    count++;
    // Generate random data for logging
    const message = generateRandomMessage();
    // const dataObject = generateRandomDataObject();

    // Randomly call a log level function
    const logLevel = Math.floor(Math.random() * 4);

    switch (logLevel) {
      case 0:
        console.warn(message, dataObject);
        break;
      case 1:
        console.debug(message, dataObject, { metrics: { processedCount: 2 } });
        break;
      case 2:
        console.info(message, dataObject, { meta: { foo: "bar" } });
        break;
      case 3:
        console.log(message, dataObject);
        break;
      default:
        console.log("Unknown log level", message, dataObject);
        break;
    }
    metrics.increment("processedCount");
  }
}

initLogger({
  logSecondsBetweenMetrics: 15,
  logLevel: "trace",
  logObjects: false,
});
// Define the number of iterations (how many times to generate log messages)

// Run the logger test
const numIterations = 1000; // You can adjust this number
runInContext({ animal: "dog" }, () => generateLogs(numIterations));
consoleMetrics("acme", { boxes: 10, ramps: 1})

console.log(`Created ${count} log messages`);
metrics.log();
console.log("Done with emptyLogQueueSync");
