(() => {
  const original = Document.prototype.querySelector;
  const customerFilterNames = new Set([
    'customerLotFilter',
    'customerFrequencyFilter',
    'customerStatusFilter'
  ]);

  Document.prototype.querySelector = function(selector) {
    const found = original.call(this, selector);
    if (found) return found;
    if (typeof selector === 'string' && selector.startsWith('#')) {
      const name = selector.slice(1);
      if (customerFilterNames.has(name)) {
        return original.call(this, `[name="${name}"]`);
      }
    }
    return null;
  };
})();
