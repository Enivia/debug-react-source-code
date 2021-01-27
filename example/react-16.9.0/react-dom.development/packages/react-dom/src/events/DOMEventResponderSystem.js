// Intentionally not named imports because Rollup would use dynamic dispatch for
// CommonJS interop named imports.
var UserBlockingPriority$1 = unstable_UserBlockingPriority;
var runWithPriority$1 = unstable_runWithPriority;


var listenToResponderEventTypesImpl = void 0;

function setListenToResponderEventTypes(_listenToResponderEventTypesImpl) {
  listenToResponderEventTypesImpl = _listenToResponderEventTypesImpl;
}

var activeTimeouts = new Map();
var rootEventTypesToEventResponderInstances = new Map();
var ownershipChangeListeners = new Set();

var globalOwner = null;

var currentTimeStamp = 0;
var currentTimers = new Map();
var currentInstance = null;
var currentEventQueue = null;
var currentEventQueuePriority = ContinuousEvent;
var currentTimerIDCounter = 0;
var currentDocument = null;

var eventResponderContext = {
  dispatchEvent: function (eventValue, eventListener, eventPriority) {
    validateResponderContext();
    validateEventValue(eventValue);
    if (eventPriority < currentEventQueuePriority) {
      currentEventQueuePriority = eventPriority;
    }
    currentEventQueue.push(createEventQueueItem(eventValue, eventListener));
  },
  isTargetWithinResponder: function (target) {
    validateResponderContext();
    if (target != null) {
      var fiber = getClosestInstanceFromNode(target);
      var responderFiber = currentInstance.fiber;

      while (fiber !== null) {
        if (fiber === responderFiber || fiber.alternate === responderFiber) {
          return true;
        }
        fiber = fiber.return;
      }
    }
    return false;
  },
  isTargetWithinResponderScope: function (target) {
    validateResponderContext();
    var componentInstance = currentInstance;
    var responder = componentInstance.responder;

    if (target != null) {
      var fiber = getClosestInstanceFromNode(target);
      var responderFiber = currentInstance.fiber;

      while (fiber !== null) {
        if (fiber === responderFiber || fiber.alternate === responderFiber) {
          return true;
        }
        if (doesFiberHaveResponder(fiber, responder)) {
          return false;
        }
        fiber = fiber.return;
      }
    }
    return false;
  },
  isTargetWithinNode: function (childTarget, parentTarget) {
    validateResponderContext();
    var childFiber = getClosestInstanceFromNode(childTarget);
    var parentFiber = getClosestInstanceFromNode(parentTarget);
    var parentAlternateFiber = parentFiber.alternate;

    var node = childFiber;
    while (node !== null) {
      if (node === parentFiber || node === parentAlternateFiber) {
        return true;
      }
      node = node.return;
    }
    return false;
  },
  addRootEventTypes: function (rootEventTypes) {
    validateResponderContext();
    var activeDocument = getActiveDocument();
    listenToResponderEventTypesImpl(rootEventTypes, activeDocument);
    for (var i = 0; i < rootEventTypes.length; i++) {
      var rootEventType = rootEventTypes[i];
      var eventResponderInstance = currentInstance;
      registerRootEventType(rootEventType, eventResponderInstance);
    }
  },
  removeRootEventTypes: function (rootEventTypes) {
    validateResponderContext();
    for (var i = 0; i < rootEventTypes.length; i++) {
      var rootEventType = rootEventTypes[i];
      var rootEventResponders = rootEventTypesToEventResponderInstances.get(rootEventType);
      var rootEventTypesSet = currentInstance.rootEventTypes;
      if (rootEventTypesSet !== null) {
        rootEventTypesSet.delete(rootEventType);
      }
      if (rootEventResponders !== undefined) {
        rootEventResponders.delete(currentInstance);
      }
    }
  },
  hasOwnership: function () {
    validateResponderContext();
    return globalOwner === currentInstance;
  },
  requestGlobalOwnership: function () {
    validateResponderContext();
    if (globalOwner !== null) {
      return false;
    }
    globalOwner = currentInstance;
    triggerOwnershipListeners();
    return true;
  },
  releaseOwnership: function () {
    validateResponderContext();
    return releaseOwnershipForEventResponderInstance(currentInstance);
  },
  setTimeout: function (func, delay) {
    validateResponderContext();
    if (currentTimers === null) {
      currentTimers = new Map();
    }
    var timeout = currentTimers.get(delay);

    var timerId = currentTimerIDCounter++;
    if (timeout === undefined) {
      var _timers = new Map();
      var _id = setTimeout(function () {
        processTimers(_timers, delay);
      }, delay);
      timeout = {
        id: _id,
        timers: _timers
      };
      currentTimers.set(delay, timeout);
    }
    timeout.timers.set(timerId, {
      instance: currentInstance,
      func: func,
      id: timerId,
      timeStamp: currentTimeStamp
    });
    activeTimeouts.set(timerId, timeout);
    return timerId;
  },
  clearTimeout: function (timerId) {
    validateResponderContext();
    var timeout = activeTimeouts.get(timerId);

    if (timeout !== undefined) {
      var _timers2 = timeout.timers;
      _timers2.delete(timerId);
      if (_timers2.size === 0) {
        clearTimeout(timeout.id);
      }
    }
  },
  getFocusableElementsInScope: function (deep) {
    validateResponderContext();
    var focusableElements = [];
    var eventResponderInstance = currentInstance;
    var currentResponder = eventResponderInstance.responder;
    var focusScopeFiber = eventResponderInstance.fiber;
    if (deep) {
      var deepNode = focusScopeFiber.return;
      while (deepNode !== null) {
        if (doesFiberHaveResponder(deepNode, currentResponder)) {
          focusScopeFiber = deepNode;
        }
        deepNode = deepNode.return;
      }
    }
    var child = focusScopeFiber.child;

    if (child !== null) {
      collectFocusableElements(child, focusableElements);
    }
    return focusableElements;
  },

  getActiveDocument: getActiveDocument,
  objectAssign: _assign,
  getTimeStamp: function () {
    validateResponderContext();
    return currentTimeStamp;
  },
  isTargetWithinHostComponent: function (target, elementType) {
    validateResponderContext();
    var fiber = getClosestInstanceFromNode(target);

    while (fiber !== null) {
      if (fiber.tag === HostComponent && fiber.type === elementType) {
        return true;
      }
      fiber = fiber.return;
    }
    return false;
  },

  enqueueStateRestore: enqueueStateRestore
};

function validateEventValue(eventValue) {
  if (typeof eventValue === 'object' && eventValue !== null) {
    var target = eventValue.target,
        type = eventValue.type,
        _timeStamp = eventValue.timeStamp;


    if (target == null || type == null || _timeStamp == null) {
      throw new Error('context.dispatchEvent: "target", "timeStamp", and "type" fields on event object are required.');
    }
    var showWarning = function (name) {
      {
        warning$1(false, '%s is not available on event objects created from event responder modules (React Flare). ' + 'Try wrapping in a conditional, i.e. `if (event.type !== "press") { event.%s }`', name, name);
      }
    };
    eventValue.preventDefault = function () {
      {
        showWarning('preventDefault()');
      }
    };
    eventValue.stopPropagation = function () {
      {
        showWarning('stopPropagation()');
      }
    };
    eventValue.isDefaultPrevented = function () {
      {
        showWarning('isDefaultPrevented()');
      }
    };
    eventValue.isPropagationStopped = function () {
      {
        showWarning('isPropagationStopped()');
      }
    };
    // $FlowFixMe: we don't need value, Flow thinks we do
    Object.defineProperty(eventValue, 'nativeEvent', {
      get: function () {
        {
          showWarning('nativeEvent');
        }
      }
    });
  }
}

function collectFocusableElements(node, focusableElements) {
  if (isFiberSuspenseAndTimedOut(node)) {
    var fallbackChild = getSuspenseFallbackChild(node);
    if (fallbackChild !== null) {
      collectFocusableElements(fallbackChild, focusableElements);
    }
  } else {
    if (isFiberHostComponentFocusable(node)) {
      focusableElements.push(node.stateNode);
    } else {
      var child = node.child;

      if (child !== null) {
        collectFocusableElements(child, focusableElements);
      }
    }
  }
  var sibling = node.sibling;

  if (sibling !== null) {
    collectFocusableElements(sibling, focusableElements);
  }
}

function createEventQueueItem(value, listener) {
  return {
    value: value,
    listener: listener
  };
}

function doesFiberHaveResponder(fiber, responder) {
  if (fiber.tag === HostComponent) {
    var dependencies = fiber.dependencies;
    if (dependencies !== null) {
      var respondersMap = dependencies.responders;
      if (respondersMap !== null && respondersMap.has(responder)) {
        return true;
      }
    }
  }
  return false;
}

function getActiveDocument() {
  return currentDocument;
}

function releaseOwnershipForEventResponderInstance(eventResponderInstance) {
  if (globalOwner === eventResponderInstance) {
    globalOwner = null;
    triggerOwnershipListeners();
    return true;
  }
  return false;
}

function isFiberHostComponentFocusable(fiber) {
  if (fiber.tag !== HostComponent) {
    return false;
  }
  var type = fiber.type,
      memoizedProps = fiber.memoizedProps;

  if (memoizedProps.tabIndex === -1 || memoizedProps.disabled) {
    return false;
  }
  if (memoizedProps.tabIndex === 0 || memoizedProps.contentEditable === true) {
    return true;
  }
  if (type === 'a' || type === 'area') {
    return !!memoizedProps.href && memoizedProps.rel !== 'ignore';
  }
  if (type === 'input') {
    return memoizedProps.type !== 'hidden' && memoizedProps.type !== 'file';
  }
  return type === 'button' || type === 'textarea' || type === 'object' || type === 'select' || type === 'iframe' || type === 'embed';
}

function processTimers(timers, delay) {
  var timersArr = Array.from(timers.values());
  currentEventQueuePriority = ContinuousEvent;
  try {
    for (var i = 0; i < timersArr.length; i++) {
      var _timersArr$i = timersArr[i],
          _instance = _timersArr$i.instance,
          _func = _timersArr$i.func,
          _id2 = _timersArr$i.id,
          _timeStamp2 = _timersArr$i.timeStamp;

      currentInstance = _instance;
      currentEventQueue = [];
      currentTimeStamp = _timeStamp2 + delay;
      try {
        _func();
      } finally {
        activeTimeouts.delete(_id2);
      }
    }
    processEventQueue();
  } finally {
    currentTimers = null;
    currentInstance = null;
    currentEventQueue = null;
    currentTimeStamp = 0;
  }
}

function createDOMResponderEvent(topLevelType, nativeEvent, nativeEventTarget, passive, passiveSupported) {
  var _ref = nativeEvent,
      pointerType = _ref.pointerType;

  var eventPointerType = '';
  var pointerId = null;

  if (pointerType !== undefined) {
    eventPointerType = pointerType;
    pointerId = nativeEvent.pointerId;
  } else if (nativeEvent.key !== undefined) {
    eventPointerType = 'keyboard';
  } else if (nativeEvent.button !== undefined) {
    eventPointerType = 'mouse';
  } else if (nativeEvent.changedTouches !== undefined) {
    eventPointerType = 'touch';
  }

  return {
    nativeEvent: nativeEvent,
    passive: passive,
    passiveSupported: passiveSupported,
    pointerId: pointerId,
    pointerType: eventPointerType,
    responderTarget: null,
    target: nativeEventTarget,
    type: topLevelType
  };
}

function processEvents(eventQueue) {
  for (var i = 0, length = eventQueue.length; i < length; i++) {
    var _eventQueue$i = eventQueue[i],
        _value = _eventQueue$i.value,
        _listener = _eventQueue$i.listener;

    var type = typeof _value === 'object' && _value !== null ? _value.type : '';
    invokeGuardedCallbackAndCatchFirstError(type, _listener, undefined, _value);
  }
}

function processEventQueue() {
  var eventQueue = currentEventQueue;
  if (eventQueue.length === 0) {
    return;
  }
  switch (currentEventQueuePriority) {
    case DiscreteEvent:
      {
        flushDiscreteUpdatesIfNeeded(currentTimeStamp);
        discreteUpdates(function () {
          batchedEventUpdates(processEvents, eventQueue);
        });
        break;
      }
    case UserBlockingEvent:
      {
        if (enableUserBlockingEvents) {
          runWithPriority$1(UserBlockingPriority$1, batchedEventUpdates.bind(null, processEvents, eventQueue));
        } else {
          batchedEventUpdates(processEvents, eventQueue);
        }
        break;
      }
    case ContinuousEvent:
      {
        batchedEventUpdates(processEvents, eventQueue);
        break;
      }
  }
}

function responderEventTypesContainType(eventTypes, type) {
  for (var i = 0, len = eventTypes.length; i < len; i++) {
    if (eventTypes[i] === type) {
      return true;
    }
  }
  return false;
}

function validateResponderTargetEventTypes(eventType, responder) {
  var targetEventTypes = responder.targetEventTypes;
  // Validate the target event type exists on the responder

  if (targetEventTypes !== null) {
    return responderEventTypesContainType(targetEventTypes, eventType);
  }
  return false;
}

function validateOwnership(responderInstance) {
  return globalOwner === null || globalOwner === responderInstance;
}

function traverseAndHandleEventResponderInstances(topLevelType, targetFiber, nativeEvent, nativeEventTarget, eventSystemFlags) {
  var isPassiveEvent = (eventSystemFlags & IS_PASSIVE) !== 0;
  var isPassiveSupported = (eventSystemFlags & PASSIVE_NOT_SUPPORTED) === 0;
  var isPassive = isPassiveEvent || !isPassiveSupported;
  var eventType = isPassive ? topLevelType : topLevelType + '_active';

  // Trigger event responders in this order:
  // - Bubble target responder phase
  // - Root responder phase

  var visitedResponders = new Set();
  var responderEvent = createDOMResponderEvent(topLevelType, nativeEvent, nativeEventTarget, isPassiveEvent, isPassiveSupported);
  var node = targetFiber;
  while (node !== null) {
    var _node = node,
        dependencies = _node.dependencies,
        tag = _node.tag;

    if (tag === HostComponent && dependencies !== null) {
      var respondersMap = dependencies.responders;
      if (respondersMap !== null) {
        var responderInstances = Array.from(respondersMap.values());
        for (var i = 0, length = responderInstances.length; i < length; i++) {
          var responderInstance = responderInstances[i];

          if (validateOwnership(responderInstance)) {
            var props = responderInstance.props,
                responder = responderInstance.responder,
                state = responderInstance.state,
                target = responderInstance.target;

            if (!visitedResponders.has(responder) && validateResponderTargetEventTypes(eventType, responder)) {
              visitedResponders.add(responder);
              var onEvent = responder.onEvent;
              if (onEvent !== null) {
                currentInstance = responderInstance;
                responderEvent.responderTarget = target;
                onEvent(responderEvent, eventResponderContext, props, state);
              }
            }
          }
        }
      }
    }
    node = node.return;
  }
  // Root phase
  var rootEventResponderInstances = rootEventTypesToEventResponderInstances.get(eventType);
  if (rootEventResponderInstances !== undefined) {
    var _responderInstances = Array.from(rootEventResponderInstances);

    for (var _i = 0; _i < _responderInstances.length; _i++) {
      var _responderInstance = _responderInstances[_i];
      if (!validateOwnership(_responderInstance)) {
        continue;
      }
      var _props = _responderInstance.props,
          _responder = _responderInstance.responder,
          _state = _responderInstance.state,
          _target = _responderInstance.target;

      var onRootEvent = _responder.onRootEvent;
      if (onRootEvent !== null) {
        currentInstance = _responderInstance;
        responderEvent.responderTarget = _target;
        onRootEvent(responderEvent, eventResponderContext, _props, _state);
      }
    }
  }
}

function triggerOwnershipListeners() {
  var listeningInstances = Array.from(ownershipChangeListeners);
  var previousInstance = currentInstance;
  var previousEventQueuePriority = currentEventQueuePriority;
  var previousEventQueue = currentEventQueue;
  try {
    for (var i = 0; i < listeningInstances.length; i++) {
      var _instance2 = listeningInstances[i];
      var props = _instance2.props,
          responder = _instance2.responder,
          state = _instance2.state;

      currentInstance = _instance2;
      currentEventQueuePriority = ContinuousEvent;
      currentEventQueue = [];
      var onOwnershipChange = responder.onOwnershipChange;
      if (onOwnershipChange !== null) {
        onOwnershipChange(eventResponderContext, props, state);
      }
    }
    processEventQueue();
  } finally {
    currentInstance = previousInstance;
    currentEventQueue = previousEventQueue;
    currentEventQueuePriority = previousEventQueuePriority;
  }
}

function mountEventResponder(responder, responderInstance, props, state) {
  if (responder.onOwnershipChange !== null) {
    ownershipChangeListeners.add(responderInstance);
  }
  var onMount = responder.onMount;
  if (onMount !== null) {
    currentEventQueuePriority = ContinuousEvent;
    currentInstance = responderInstance;
    currentEventQueue = [];
    try {
      onMount(eventResponderContext, props, state);
      processEventQueue();
    } finally {
      currentEventQueue = null;
      currentInstance = null;
      currentTimers = null;
    }
  }
}

function unmountEventResponder(responderInstance) {
  var responder = responderInstance.responder;
  var onUnmount = responder.onUnmount;
  if (onUnmount !== null) {
    var props = responderInstance.props,
        state = responderInstance.state;

    currentEventQueue = [];
    currentEventQueuePriority = ContinuousEvent;
    currentInstance = responderInstance;
    try {
      onUnmount(eventResponderContext, props, state);
      processEventQueue();
    } finally {
      currentEventQueue = null;
      currentInstance = null;
      currentTimers = null;
    }
  }
  releaseOwnershipForEventResponderInstance(responderInstance);
  if (responder.onOwnershipChange !== null) {
    ownershipChangeListeners.delete(responderInstance);
  }
  var rootEventTypesSet = responderInstance.rootEventTypes;
  if (rootEventTypesSet !== null) {
    var rootEventTypes = Array.from(rootEventTypesSet);

    for (var i = 0; i < rootEventTypes.length; i++) {
      var topLevelEventType = rootEventTypes[i];
      var rootEventResponderInstances = rootEventTypesToEventResponderInstances.get(topLevelEventType);
      if (rootEventResponderInstances !== undefined) {
        rootEventResponderInstances.delete(responderInstance);
      }
    }
  }
}

function validateResponderContext() {
  (function () {
    if (!(currentInstance !== null)) {
      {
        throw ReactError(Error('An event responder context was used outside of an event cycle. Use context.setTimeout() to use asynchronous responder context outside of event cycle .'));
      }
    }
  })();
}

function dispatchEventForResponderEventSystem(topLevelType, targetFiber, nativeEvent, nativeEventTarget, eventSystemFlags) {
  if (enableFlareAPI) {
    var previousEventQueue = currentEventQueue;
    var previousInstance = currentInstance;
    var previousTimers = currentTimers;
    var previousTimeStamp = currentTimeStamp;
    var previousDocument = currentDocument;
    var previousEventQueuePriority = currentEventQueuePriority;
    currentTimers = null;
    currentEventQueue = [];
    currentEventQueuePriority = ContinuousEvent;
    // nodeType 9 is DOCUMENT_NODE
    currentDocument = nativeEventTarget.nodeType === 9 ? nativeEventTarget : nativeEventTarget.ownerDocument;
    // We might want to control timeStamp another way here
    currentTimeStamp = nativeEvent.timeStamp;
    try {
      traverseAndHandleEventResponderInstances(topLevelType, targetFiber, nativeEvent, nativeEventTarget, eventSystemFlags);
      processEventQueue();
    } finally {
      currentTimers = previousTimers;
      currentInstance = previousInstance;
      currentEventQueue = previousEventQueue;
      currentTimeStamp = previousTimeStamp;
      currentDocument = previousDocument;
      currentEventQueuePriority = previousEventQueuePriority;
    }
  }
}

function addRootEventTypesForResponderInstance(responderInstance, rootEventTypes) {
  for (var i = 0; i < rootEventTypes.length; i++) {
    var rootEventType = rootEventTypes[i];
    registerRootEventType(rootEventType, responderInstance);
  }
}

function registerRootEventType(rootEventType, eventResponderInstance) {
  var rootEventResponderInstances = rootEventTypesToEventResponderInstances.get(rootEventType);
  if (rootEventResponderInstances === undefined) {
    rootEventResponderInstances = new Set();
    rootEventTypesToEventResponderInstances.set(rootEventType, rootEventResponderInstances);
  }
  var rootEventTypesSet = eventResponderInstance.rootEventTypes;
  if (rootEventTypesSet === null) {
    rootEventTypesSet = eventResponderInstance.rootEventTypes = new Set();
  }
  (function () {
    if (!!rootEventTypesSet.has(rootEventType)) {
      {
        throw ReactError(Error('addRootEventTypes() found a duplicate root event type of "' + rootEventType + '". This might be because the event type exists in the event responder "rootEventTypes" array or because of a previous addRootEventTypes() using this root event type.'));
      }
    }
  })();
  rootEventTypesSet.add(rootEventType);
  rootEventResponderInstances.add(eventResponderInstance);
}