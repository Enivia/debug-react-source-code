

// Intentionally not named imports because Rollup would use dynamic dispatch for
// CommonJS interop named imports.
var UserBlockingPriority = unstable_UserBlockingPriority;
var runWithPriority = unstable_runWithPriority;
var getEventPriority = SimpleEventPlugin.getEventPriority;


var CALLBACK_BOOKKEEPING_POOL_SIZE = 10;
var callbackBookkeepingPool = [];

/**
 * Find the deepest React component completely containing the root of the
 * passed-in instance (for use when entire React trees are nested within each
 * other). If React trees are not nested, returns null.
 */
function findRootContainerNode(inst) {
  // TODO: It may be a good idea to cache this to prevent unnecessary DOM
  // traversal, but caching is difficult to do correctly without using a
  // mutation observer to listen for all DOM changes.
  while (inst.return) {
    inst = inst.return;
  }
  if (inst.tag !== HostRoot) {
    // This can happen if we're in a detached tree.
    return null;
  }
  return inst.stateNode.containerInfo;
}

// Used to store ancestor hierarchy in top level callback
function getTopLevelCallbackBookKeeping(topLevelType, nativeEvent, targetInst) {
  if (callbackBookkeepingPool.length) {
    var instance = callbackBookkeepingPool.pop();
    instance.topLevelType = topLevelType;
    instance.nativeEvent = nativeEvent;
    instance.targetInst = targetInst;
    return instance;
  }
  return {
    topLevelType: topLevelType,
    nativeEvent: nativeEvent,
    targetInst: targetInst,
    ancestors: []
  };
}

function releaseTopLevelCallbackBookKeeping(instance) {
  instance.topLevelType = null;
  instance.nativeEvent = null;
  instance.targetInst = null;
  instance.ancestors.length = 0;
  if (callbackBookkeepingPool.length < CALLBACK_BOOKKEEPING_POOL_SIZE) {
    callbackBookkeepingPool.push(instance);
  }
}

function handleTopLevel(bookKeeping) {
  var targetInst = bookKeeping.targetInst;

  // Loop through the hierarchy, in case there's any nested components.
  // It's important that we build the array of ancestors before calling any
  // event handlers, because event handlers can modify the DOM, leading to
  // inconsistencies with ReactMount's node cache. See #1105.
  var ancestor = targetInst;
  do {
    if (!ancestor) {
      var _ancestors = bookKeeping.ancestors;
      _ancestors.push(ancestor);
      break;
    }
    var root = findRootContainerNode(ancestor);
    if (!root) {
      break;
    }
    bookKeeping.ancestors.push(ancestor);
    ancestor = getClosestInstanceFromNode(root);
  } while (ancestor);

  for (var i = 0; i < bookKeeping.ancestors.length; i++) {
    targetInst = bookKeeping.ancestors[i];
    var eventTarget = getEventTarget(bookKeeping.nativeEvent);
    var _topLevelType = bookKeeping.topLevelType;
    var _nativeEvent = bookKeeping.nativeEvent;

    runExtractedPluginEventsInBatch(_topLevelType, targetInst, _nativeEvent, eventTarget);
  }
}

// TODO: can we stop exporting these?
var _enabled = true;

function setEnabled(enabled) {
  _enabled = !!enabled;
}

function isEnabled() {
  return _enabled;
}

function trapBubbledEvent(topLevelType, element) {
  trapEventForPluginEventSystem(element, topLevelType, false);
}

function trapCapturedEvent(topLevelType, element) {
  trapEventForPluginEventSystem(element, topLevelType, true);
}

function trapEventForResponderEventSystem(element, topLevelType, passive) {
  if (enableFlareAPI) {
    var rawEventName = getRawEventName(topLevelType);
    var eventFlags = RESPONDER_EVENT_SYSTEM;

    // If passive option is not supported, then the event will be
    // active and not passive, but we flag it as using not being
    // supported too. This way the responder event plugins know,
    // and can provide polyfills if needed.
    if (passive) {
      if (passiveBrowserEventsSupported) {
        eventFlags |= IS_PASSIVE;
      } else {
        eventFlags |= IS_ACTIVE;
        eventFlags |= PASSIVE_NOT_SUPPORTED;
        passive = false;
      }
    } else {
      eventFlags |= IS_ACTIVE;
    }
    // Check if interactive and wrap in discreteUpdates
    var listener = dispatchEvent.bind(null, topLevelType, eventFlags);
    if (passiveBrowserEventsSupported) {
      addEventCaptureListenerWithPassiveFlag(element, rawEventName, listener, passive);
    } else {
      addEventCaptureListener(element, rawEventName, listener);
    }
  }
}

function trapEventForPluginEventSystem(element, topLevelType, capture) {
  var listener = void 0;
  switch (getEventPriority(topLevelType)) {
    case DiscreteEvent:
      listener = dispatchDiscreteEvent.bind(null, topLevelType, PLUGIN_EVENT_SYSTEM);
      break;
    case UserBlockingEvent:
      listener = dispatchUserBlockingUpdate.bind(null, topLevelType, PLUGIN_EVENT_SYSTEM);
      break;
    case ContinuousEvent:
    default:
      listener = dispatchEvent.bind(null, topLevelType, PLUGIN_EVENT_SYSTEM);
      break;
  }

  var rawEventName = getRawEventName(topLevelType);
  if (capture) {
    addEventCaptureListener(element, rawEventName, listener);
  } else {
    addEventBubbleListener(element, rawEventName, listener);
  }
}

function dispatchDiscreteEvent(topLevelType, eventSystemFlags, nativeEvent) {
  flushDiscreteUpdatesIfNeeded(nativeEvent.timeStamp);
  discreteUpdates(dispatchEvent, topLevelType, eventSystemFlags, nativeEvent);
}

function dispatchUserBlockingUpdate(topLevelType, eventSystemFlags, nativeEvent) {
  if (enableUserBlockingEvents) {
    runWithPriority(UserBlockingPriority, dispatchEvent.bind(null, topLevelType, eventSystemFlags, nativeEvent));
  } else {
    dispatchEvent(topLevelType, eventSystemFlags, nativeEvent);
  }
}

function dispatchEventForPluginEventSystem(topLevelType, eventSystemFlags, nativeEvent, targetInst) {
  var bookKeeping = getTopLevelCallbackBookKeeping(topLevelType, nativeEvent, targetInst);

  try {
    // Event queue being processed in the same cycle allows
    // `preventDefault`.
    batchedEventUpdates(handleTopLevel, bookKeeping);
  } finally {
    releaseTopLevelCallbackBookKeeping(bookKeeping);
  }
}

function dispatchEvent(topLevelType, eventSystemFlags, nativeEvent) {
  if (!_enabled) {
    return;
  }
  var nativeEventTarget = getEventTarget(nativeEvent);
  var targetInst = getClosestInstanceFromNode(nativeEventTarget);

  if (targetInst !== null && typeof targetInst.tag === 'number' && !isFiberMounted(targetInst)) {
    // If we get an event (ex: img onload) before committing that
    // component's mount, ignore it for now (that is, treat it as if it was an
    // event on a non-React tree). We might also consider queueing events and
    // dispatching them after the mount.
    targetInst = null;
  }

  if (enableFlareAPI) {
    if (eventSystemFlags === PLUGIN_EVENT_SYSTEM) {
      dispatchEventForPluginEventSystem(topLevelType, eventSystemFlags, nativeEvent, targetInst);
    } else {
      // React Flare event system
      dispatchEventForResponderEventSystem(topLevelType, targetInst, nativeEvent, nativeEventTarget, eventSystemFlags);
    }
  } else {
    dispatchEventForPluginEventSystem(topLevelType, eventSystemFlags, nativeEvent, targetInst);
  }
}