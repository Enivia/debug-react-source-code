// Renderers that don't support persistence
// can re-export everything from this module.

function shim() {
  (function () {
    {
      {
        throw ReactError(Error('The current renderer does not support persistence. This error is likely caused by a bug in React. Please file an issue.'));
      }
    }
  })();
}

// Persistence (when unsupported)
var supportsPersistence = false;
var cloneInstance = shim;
var cloneFundamentalInstance = shim;
var createContainerChildSet = shim;
var appendChildToContainerChildSet = shim;
var finalizeContainerChildren = shim;
var replaceContainerChildren = shim;
var cloneHiddenInstance = shim;
var cloneHiddenTextInstance = shim;