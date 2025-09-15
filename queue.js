// queue.js
const jobs = [];
const processors = [];

module.exports = {
  add: (data) => {
    return new Promise((resolve) => {
      const job = { data, resolve };
      jobs.push(job);
      runNext();
    });
  },
  process: (fn) => {
    processors.push(fn);
    runNext();
  },
};

function runNext() {
  if (jobs.length === 0 || processors.length === 0) return;
  const job = jobs.shift();
  const processor = processors[0];
  processor(job).then((result) => job.resolve(result));
}
