// injected.js
(function() {
    const pushState = history.pushState;
    const replaceState = history.replaceState;
  
    function urlChangeHandler(method, ...args) {
      const url = args[2];
      window.dispatchEvent(new CustomEvent('urlChange', { detail: url }));
      return method.apply(history, args);
    }
  
    history.pushState = function(...args) {
      return urlChangeHandler(pushState, ...args);
    };
  
    history.replaceState = function(...args) {
      return urlChangeHandler(replaceState, ...args);
    };
  
    window.addEventListener('popstate', () => {
      const url = window.location.href;
      window.dispatchEvent(new CustomEvent('urlChange', { detail: url }));
    });
  })();
  