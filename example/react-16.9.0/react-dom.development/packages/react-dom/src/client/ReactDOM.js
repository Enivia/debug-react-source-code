// TODO: This type is shared between the reconciler and ReactDOM, but will
// eventually be lifted out to the renderer.

var ReactCurrentOwner = ReactSharedInternals.ReactCurrentOwner;

var topLevelUpdateWarnings = void 0;
var warnOnInvalidCallback = void 0;
var didWarnAboutUnstableCreatePortal = false;

{
  if (typeof Map !== 'function' ||
  // $FlowIssue Flow incorrectly thinks Map has no prototype
  Map.prototype == null || typeof Map.prototype.forEach !== 'function' || typeof Set !== 'function' ||
  // $FlowIssue Flow incorrectly thinks Set has no prototype
  Set.prototype == null || typeof Set.prototype.clear !== 'function' || typeof Set.prototype.forEach !== 'function') {
    warningWithoutStack$1(false, 'React depends on Map and Set built-in types. Make sure that you load a ' + 'polyfill in older browsers. https://fb.me/react-polyfills');
  }

  topLevelUpdateWarnings = function (container) {
    if (container._reactRootContainer && container.nodeType !== COMMENT_NODE) {
      var hostInstance = findHostInstanceWithNoPortals(container._reactRootContainer._internalRoot.current);
      if (hostInstance) {
        !(hostInstance.parentNode === container) ? warningWithoutStack$1(false, 'render(...): It looks like the React-rendered content of this ' + 'container was removed without using React. This is not ' + 'supported and will cause errors. Instead, call ' + 'ReactDOM.unmountComponentAtNode to empty a container.') : void 0;
      }
    }

    var isRootRenderedBySomeReact = !!container._reactRootContainer;
    var rootEl = getReactRootElementInContainer(container);
    var hasNonRootReactChild = !!(rootEl && getInstanceFromNode$1(rootEl));

    !(!hasNonRootReactChild || isRootRenderedBySomeReact) ? warningWithoutStack$1(false, 'render(...): Replacing React-rendered children with a new root ' + 'component. If you intended to update the children of this node, ' + 'you should instead have the existing children update their state ' + 'and render the new components instead of calling ReactDOM.render.') : void 0;

    !(container.nodeType !== ELEMENT_NODE || !container.tagName || container.tagName.toUpperCase() !== 'BODY') ? warningWithoutStack$1(false, 'render(): Rendering components directly into document.body is ' + 'discouraged, since its children are often manipulated by third-party ' + 'scripts and browser extensions. This may lead to subtle ' + 'reconciliation issues. Try rendering into a container element created ' + 'for your app.') : void 0;
  };

  warnOnInvalidCallback = function (callback, callerName) {
    !(callback === null || typeof callback === 'function') ? warningWithoutStack$1(false, '%s(...): Expected the last optional `callback` argument to be a ' + 'function. Instead received: %s.', callerName, callback) : void 0;
  };
}

setRestoreImplementation(restoreControlledState$1);

function ReactBatch(root) {
  var expirationTime = computeUniqueAsyncExpiration();
  this._expirationTime = expirationTime;
  this._root = root;
  this._next = null;
  this._callbacks = null;
  this._didComplete = false;
  this._hasChildren = false;
  this._children = null;
  this._defer = true;
}
ReactBatch.prototype.render = function (children) {
  var _this = this;

  (function () {
    if (!_this._defer) {
      {
        throw ReactError(Error('batch.render: Cannot render a batch that already committed.'));
      }
    }
  })();
  this._hasChildren = true;
  this._children = children;
  var internalRoot = this._root._internalRoot;
  var expirationTime = this._expirationTime;
  var work = new ReactWork();
  updateContainerAtExpirationTime(children, internalRoot, null, expirationTime, null, work._onCommit);
  return work;
};
ReactBatch.prototype.then = function (onComplete) {
  if (this._didComplete) {
    onComplete();
    return;
  }
  var callbacks = this._callbacks;
  if (callbacks === null) {
    callbacks = this._callbacks = [];
  }
  callbacks.push(onComplete);
};
ReactBatch.prototype.commit = function () {
  var _this2 = this;

  var internalRoot = this._root._internalRoot;
  var firstBatch = internalRoot.firstBatch;
  (function () {
    if (!(_this2._defer && firstBatch !== null)) {
      {
        throw ReactError(Error('batch.commit: Cannot commit a batch multiple times.'));
      }
    }
  })();

  if (!this._hasChildren) {
    // This batch is empty. Return.
    this._next = null;
    this._defer = false;
    return;
  }

  var expirationTime = this._expirationTime;

  // Ensure this is the first batch in the list.
  if (firstBatch !== this) {
    // This batch is not the earliest batch. We need to move it to the front.
    // Update its expiration time to be the expiration time of the earliest
    // batch, so that we can flush it without flushing the other batches.
    if (this._hasChildren) {
      expirationTime = this._expirationTime = firstBatch._expirationTime;
      // Rendering this batch again ensures its children will be the final state
      // when we flush (updates are processed in insertion order: last
      // update wins).
      // TODO: This forces a restart. Should we print a warning?
      this.render(this._children);
    }

    // Remove the batch from the list.
    var previous = null;
    var batch = firstBatch;
    while (batch !== this) {
      previous = batch;
      batch = batch._next;
    }
    (function () {
      if (!(previous !== null)) {
        {
          throw ReactError(Error('batch.commit: Cannot commit a batch multiple times.'));
        }
      }
    })();
    previous._next = batch._next;

    // Add it to the front.
    this._next = firstBatch;
    firstBatch = internalRoot.firstBatch = this;
  }

  // Synchronously flush all the work up to this batch's expiration time.
  this._defer = false;
  flushRoot(internalRoot, expirationTime);

  // Pop the batch from the list.
  var next = this._next;
  this._next = null;
  firstBatch = internalRoot.firstBatch = next;

  // Append the next earliest batch's children to the update queue.
  if (firstBatch !== null && firstBatch._hasChildren) {
    firstBatch.render(firstBatch._children);
  }
};
ReactBatch.prototype._onComplete = function () {
  if (this._didComplete) {
    return;
  }
  this._didComplete = true;
  var callbacks = this._callbacks;
  if (callbacks === null) {
    return;
  }
  // TODO: Error handling.
  for (var i = 0; i < callbacks.length; i++) {
    var _callback = callbacks[i];
    _callback();
  }
};

function ReactWork() {
  this._callbacks = null;
  this._didCommit = false;
  // TODO: Avoid need to bind by replacing callbacks in the update queue with
  // list of Work objects.
  this._onCommit = this._onCommit.bind(this);
}
ReactWork.prototype.then = function (onCommit) {
  if (this._didCommit) {
    onCommit();
    return;
  }
  var callbacks = this._callbacks;
  if (callbacks === null) {
    callbacks = this._callbacks = [];
  }
  callbacks.push(onCommit);
};
ReactWork.prototype._onCommit = function () {
  if (this._didCommit) {
    return;
  }
  this._didCommit = true;
  var callbacks = this._callbacks;
  if (callbacks === null) {
    return;
  }
  // TODO: Error handling.
  for (var i = 0; i < callbacks.length; i++) {
    var _callback2 = callbacks[i];
    (function () {
      if (!(typeof _callback2 === 'function')) {
        {
          throw ReactError(Error('Invalid argument passed as callback. Expected a function. Instead received: ' + _callback2));
        }
      }
    })();
    _callback2();
  }
};

function ReactSyncRoot(container, tag, hydrate) {
  // Tag is either LegacyRoot or Concurrent Root
  var root = createContainer(container, tag, hydrate);
  this._internalRoot = root;
}

function ReactRoot(container, hydrate) {
  var root = createContainer(container, ConcurrentRoot, hydrate);
  this._internalRoot = root;
}

ReactRoot.prototype.render = ReactSyncRoot.prototype.render = function (children, callback) {
  var root = this._internalRoot;
  var work = new ReactWork();
  callback = callback === undefined ? null : callback;
  {
    warnOnInvalidCallback(callback, 'render');
  }
  if (callback !== null) {
    work.then(callback);
  }
  updateContainer(children, root, null, work._onCommit);
  return work;
};

ReactRoot.prototype.unmount = ReactSyncRoot.prototype.unmount = function (callback) {
  var root = this._internalRoot;
  var work = new ReactWork();
  callback = callback === undefined ? null : callback;
  {
    warnOnInvalidCallback(callback, 'render');
  }
  if (callback !== null) {
    work.then(callback);
  }
  updateContainer(null, root, null, work._onCommit);
  return work;
};

// Sync roots cannot create batches. Only concurrent ones.
ReactRoot.prototype.createBatch = function () {
  var batch = new ReactBatch(this);
  var expirationTime = batch._expirationTime;

  var internalRoot = this._internalRoot;
  var firstBatch = internalRoot.firstBatch;
  if (firstBatch === null) {
    internalRoot.firstBatch = batch;
    batch._next = null;
  } else {
    // Insert sorted by expiration time then insertion order
    var insertAfter = null;
    var insertBefore = firstBatch;
    while (insertBefore !== null && insertBefore._expirationTime >= expirationTime) {
      insertAfter = insertBefore;
      insertBefore = insertBefore._next;
    }
    batch._next = insertBefore;
    if (insertAfter !== null) {
      insertAfter._next = batch;
    }
  }

  return batch;
};

/**
 * True if the supplied DOM node is a valid node element.
 *
 * @param {?DOMElement} node The candidate DOM node.
 * @return {boolean} True if the DOM is a valid DOM node.
 * @internal
 */
function isValidContainer(node) {
  return !!(node && (node.nodeType === ELEMENT_NODE || node.nodeType === DOCUMENT_NODE || node.nodeType === DOCUMENT_FRAGMENT_NODE || node.nodeType === COMMENT_NODE && node.nodeValue === ' react-mount-point-unstable '));
}

function getReactRootElementInContainer(container) {
  if (!container) {
    return null;
  }

  if (container.nodeType === DOCUMENT_NODE) {
    return container.documentElement;
  } else {
    return container.firstChild;
  }
}

function shouldHydrateDueToLegacyHeuristic(container) {
  var rootElement = getReactRootElementInContainer(container);
  return !!(rootElement && rootElement.nodeType === ELEMENT_NODE && rootElement.hasAttribute(ROOT_ATTRIBUTE_NAME));
}

setBatchingImplementation(batchedUpdates$1, discreteUpdates$1, flushDiscreteUpdates, batchedEventUpdates$1);

var warnedAboutHydrateAPI = false;

function legacyCreateRootFromDOMContainer(container, forceHydrate) {
  var shouldHydrate = forceHydrate || shouldHydrateDueToLegacyHeuristic(container);
  // First clear any existing content.
  if (!shouldHydrate) {
    var warned = false;
    var rootSibling = void 0;
    while (rootSibling = container.lastChild) {
      {
        if (!warned && rootSibling.nodeType === ELEMENT_NODE && rootSibling.hasAttribute(ROOT_ATTRIBUTE_NAME)) {
          warned = true;
          warningWithoutStack$1(false, 'render(): Target node has markup rendered by React, but there ' + 'are unrelated nodes as well. This is most commonly caused by ' + 'white-space inserted around server-rendered markup.');
        }
      }
      container.removeChild(rootSibling);
    }
  }
  {
    if (shouldHydrate && !forceHydrate && !warnedAboutHydrateAPI) {
      warnedAboutHydrateAPI = true;
      lowPriorityWarning$1(false, 'render(): Calling ReactDOM.render() to hydrate server-rendered markup ' + 'will stop working in React v17. Replace the ReactDOM.render() call ' + 'with ReactDOM.hydrate() if you want React to attach to the server HTML.');
    }
  }

  // Legacy roots are not batched.
  return new ReactSyncRoot(container, LegacyRoot, shouldHydrate);
}

function legacyRenderSubtreeIntoContainer(parentComponent, children, container, forceHydrate, callback) {
  {
    topLevelUpdateWarnings(container);
    warnOnInvalidCallback(callback === undefined ? null : callback, 'render');
  }

  // TODO: Without `any` type, Flow says "Property cannot be accessed on any
  // member of intersection type." Whyyyyyy.
  var root = container._reactRootContainer;
  var fiberRoot = void 0;
  if (!root) {
    // Initial mount
    root = container._reactRootContainer = legacyCreateRootFromDOMContainer(container, forceHydrate);
    fiberRoot = root._internalRoot;
    if (typeof callback === 'function') {
      var originalCallback = callback;
      callback = function () {
        var instance = getPublicRootInstance(fiberRoot);
        originalCallback.call(instance);
      };
    }
    // Initial mount should not be batched.
    unbatchedUpdates(function () {
      updateContainer(children, fiberRoot, parentComponent, callback);
    });
  } else {
    fiberRoot = root._internalRoot;
    if (typeof callback === 'function') {
      var _originalCallback = callback;
      callback = function () {
        var instance = getPublicRootInstance(fiberRoot);
        _originalCallback.call(instance);
      };
    }
    // Update
    updateContainer(children, fiberRoot, parentComponent, callback);
  }
  return getPublicRootInstance(fiberRoot);
}

function createPortal$$1(children, container) {
  var key = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : null;

  (function () {
    if (!isValidContainer(container)) {
      {
        throw ReactError(Error('Target container is not a DOM element.'));
      }
    }
  })();
  // TODO: pass ReactDOM portal implementation as third argument
  return createPortal$1(children, container, null, key);
}

var ReactDOM = {
  createPortal: createPortal$$1,

  findDOMNode: function (componentOrElement) {
    {
      var owner = ReactCurrentOwner.current;
      if (owner !== null && owner.stateNode !== null) {
        var warnedAboutRefsInRender = owner.stateNode._warnedAboutRefsInRender;
        !warnedAboutRefsInRender ? warningWithoutStack$1(false, '%s is accessing findDOMNode inside its render(). ' + 'render() should be a pure function of props and state. It should ' + 'never access something that requires stale data from the previous ' + 'render, such as refs. Move this logic to componentDidMount and ' + 'componentDidUpdate instead.', getComponentName(owner.type) || 'A component') : void 0;
        owner.stateNode._warnedAboutRefsInRender = true;
      }
    }
    if (componentOrElement == null) {
      return null;
    }
    if (componentOrElement.nodeType === ELEMENT_NODE) {
      return componentOrElement;
    }
    {
      return findHostInstanceWithWarning(componentOrElement, 'findDOMNode');
    }
    return findHostInstance(componentOrElement);
  },
  hydrate: function (element, container, callback) {
    (function () {
      if (!isValidContainer(container)) {
        {
          throw ReactError(Error('Target container is not a DOM element.'));
        }
      }
    })();
    {
      !!container._reactHasBeenPassedToCreateRootDEV ? warningWithoutStack$1(false, 'You are calling ReactDOM.hydrate() on a container that was previously ' + 'passed to ReactDOM.%s(). This is not supported. ' + 'Did you mean to call createRoot(container, {hydrate: true}).render(element)?', enableStableConcurrentModeAPIs ? 'createRoot' : 'unstable_createRoot') : void 0;
    }
    // TODO: throw or warn if we couldn't hydrate?
    return legacyRenderSubtreeIntoContainer(null, element, container, true, callback);
  },
  render: function (element, container, callback) {
    (function () {
      if (!isValidContainer(container)) {
        {
          throw ReactError(Error('Target container is not a DOM element.'));
        }
      }
    })();
    {
      !!container._reactHasBeenPassedToCreateRootDEV ? warningWithoutStack$1(false, 'You are calling ReactDOM.render() on a container that was previously ' + 'passed to ReactDOM.%s(). This is not supported. ' + 'Did you mean to call root.render(element)?', enableStableConcurrentModeAPIs ? 'createRoot' : 'unstable_createRoot') : void 0;
    }
    return legacyRenderSubtreeIntoContainer(null, element, container, false, callback);
  },
  unstable_renderSubtreeIntoContainer: function (parentComponent, element, containerNode, callback) {
    (function () {
      if (!isValidContainer(containerNode)) {
        {
          throw ReactError(Error('Target container is not a DOM element.'));
        }
      }
    })();
    (function () {
      if (!(parentComponent != null && has(parentComponent))) {
        {
          throw ReactError(Error('parentComponent must be a valid React Component'));
        }
      }
    })();
    return legacyRenderSubtreeIntoContainer(parentComponent, element, containerNode, false, callback);
  },
  unmountComponentAtNode: function (container) {
    (function () {
      if (!isValidContainer(container)) {
        {
          throw ReactError(Error('unmountComponentAtNode(...): Target container is not a DOM element.'));
        }
      }
    })();

    {
      !!container._reactHasBeenPassedToCreateRootDEV ? warningWithoutStack$1(false, 'You are calling ReactDOM.unmountComponentAtNode() on a container that was previously ' + 'passed to ReactDOM.%s(). This is not supported. Did you mean to call root.unmount()?', enableStableConcurrentModeAPIs ? 'createRoot' : 'unstable_createRoot') : void 0;
    }

    if (container._reactRootContainer) {
      {
        var rootEl = getReactRootElementInContainer(container);
        var renderedByDifferentReact = rootEl && !getInstanceFromNode$1(rootEl);
        !!renderedByDifferentReact ? warningWithoutStack$1(false, "unmountComponentAtNode(): The node you're attempting to unmount " + 'was rendered by another copy of React.') : void 0;
      }

      // Unmount should not be batched.
      unbatchedUpdates(function () {
        legacyRenderSubtreeIntoContainer(null, null, container, false, function () {
          container._reactRootContainer = null;
        });
      });
      // If you call unmountComponentAtNode twice in quick succession, you'll
      // get `true` twice. That's probably fine?
      return true;
    } else {
      {
        var _rootEl = getReactRootElementInContainer(container);
        var hasNonRootReactChild = !!(_rootEl && getInstanceFromNode$1(_rootEl));

        // Check if the container itself is a React root node.
        var isContainerReactRoot = container.nodeType === ELEMENT_NODE && isValidContainer(container.parentNode) && !!container.parentNode._reactRootContainer;

        !!hasNonRootReactChild ? warningWithoutStack$1(false, "unmountComponentAtNode(): The node you're attempting to unmount " + 'was rendered by React and is not a top-level container. %s', isContainerReactRoot ? 'You may have accidentally passed in a React root node instead ' + 'of its container.' : 'Instead, have the parent component update its state and ' + 'rerender in order to remove this component.') : void 0;
      }

      return false;
    }
  },


  // Temporary alias since we already shipped React 16 RC with it.
  // TODO: remove in React 17.
  unstable_createPortal: function () {
    if (!didWarnAboutUnstableCreatePortal) {
      didWarnAboutUnstableCreatePortal = true;
      lowPriorityWarning$1(false, 'The ReactDOM.unstable_createPortal() alias has been deprecated, ' + 'and will be removed in React 17+. Update your code to use ' + 'ReactDOM.createPortal() instead. It has the exact same API, ' + 'but without the "unstable_" prefix.');
    }
    return createPortal$$1.apply(undefined, arguments);
  },


  unstable_batchedUpdates: batchedUpdates$1,

  // TODO remove this legacy method, unstable_discreteUpdates replaces it
  unstable_interactiveUpdates: function (fn, a, b, c) {
    flushDiscreteUpdates();
    return discreteUpdates$1(fn, a, b, c);
  },

  unstable_discreteUpdates: discreteUpdates$1,
  unstable_flushDiscreteUpdates: flushDiscreteUpdates,

  flushSync: flushSync,

  unstable_createRoot: createRoot,
  unstable_createSyncRoot: createSyncRoot,
  unstable_flushControlled: flushControlled,

  __SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED: {
    // Keep in sync with ReactDOMUnstableNativeDependencies.js
    // ReactTestUtils.js, and ReactTestUtilsAct.js. This is an array for better minification.
    Events: [getInstanceFromNode$1, getNodeFromInstance$1, getFiberCurrentPropsFromNode$1, injection.injectEventPluginsByName, eventNameDispatchConfigs, accumulateTwoPhaseDispatches, accumulateDirectDispatches, enqueueStateRestore, restoreStateIfNeeded, dispatchEvent, runEventsInBatch, flushPassiveEffects, IsThisRendererActing]
  }
};

function createRoot(container, options) {
  var functionName = enableStableConcurrentModeAPIs ? 'createRoot' : 'unstable_createRoot';
  (function () {
    if (!isValidContainer(container)) {
      {
        throw ReactError(Error(functionName + '(...): Target container is not a DOM element.'));
      }
    }
  })();
  warnIfReactDOMContainerInDEV(container);
  var hydrate = options != null && options.hydrate === true;
  return new ReactRoot(container, hydrate);
}

function createSyncRoot(container, options) {
  var functionName = enableStableConcurrentModeAPIs ? 'createRoot' : 'unstable_createRoot';
  (function () {
    if (!isValidContainer(container)) {
      {
        throw ReactError(Error(functionName + '(...): Target container is not a DOM element.'));
      }
    }
  })();
  warnIfReactDOMContainerInDEV(container);
  var hydrate = options != null && options.hydrate === true;
  return new ReactSyncRoot(container, BatchedRoot, hydrate);
}

function warnIfReactDOMContainerInDEV(container) {
  {
    !!container._reactRootContainer ? warningWithoutStack$1(false, 'You are calling ReactDOM.%s() on a container that was previously ' + 'passed to ReactDOM.render(). This is not supported.', enableStableConcurrentModeAPIs ? 'createRoot' : 'unstable_createRoot') : void 0;
    container._reactHasBeenPassedToCreateRootDEV = true;
  }
}

if (enableStableConcurrentModeAPIs) {
  ReactDOM.createRoot = createRoot;
  ReactDOM.createSyncRoot = createSyncRoot;
}

var foundDevTools = injectIntoDevTools({
  findFiberByHostInstance: getClosestInstanceFromNode,
  bundleType: 1,
  version: ReactVersion,
  rendererPackageName: 'react-dom'
});

{
  if (!foundDevTools && canUseDOM && window.top === window.self) {
    // If we're in Chrome or Firefox, provide a download link if not installed.
    if (navigator.userAgent.indexOf('Chrome') > -1 && navigator.userAgent.indexOf('Edge') === -1 || navigator.userAgent.indexOf('Firefox') > -1) {
      var protocol = window.location.protocol;
      // Don't warn in exotic cases like chrome-extension://.
      if (/^(https?|file):$/.test(protocol)) {
        console.info('%cDownload the React DevTools ' + 'for a better development experience: ' + 'https://fb.me/react-devtools' + (protocol === 'file:' ? '\nYou might need to use a local HTTP server (instead of file://): ' + 'https://fb.me/react-devtools-faq' : ''), 'font-weight:bold');
      }
    }
  }
}

