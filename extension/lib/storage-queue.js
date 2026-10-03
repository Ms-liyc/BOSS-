(function (global) {
  let chain = Promise.resolve();

  function enqueue(task) {
    const run = chain.then(() => task());
    chain = run.catch(() => {});
    return run;
  }

  global.ZpingStorageQueue = { enqueue };
})(typeof globalThis !== "undefined" ? globalThis : window);
