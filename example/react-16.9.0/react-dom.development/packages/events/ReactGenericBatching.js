// Used as a way to call batchedUpdates when we don't have a reference to
// the renderer. Such as when we're dispatching events or if third party
// libraries need to call batchedUpdates. Eventually, this API will go away when
// everything is batched by default. We'll then have a similar API to opt-out of
// scheduled work and instead do synchronous work.

// Defaults
var batchedUpdatesImpl = function (fn, bookkeeping) {
  return fn(bookkeeping);
};
var discreteUpdatesImpl = function (fn, a, b, c) {
  return fn(a, b, c);
};
var flushDiscreteUpdatesImpl = function () {};
var batchedEventUpdatesImpl = batchedUpdatesImpl;

var isInsideEventHandler = false;

function finishEventHandler() {
  // Here we wait until all updates have propagated, which is important
  // when using controlled components within layers:
  // https://github.com/facebook/react/issues/1698
  // Then we restore state of any controlled component.
  var controlledComponentsHavePendingUpdates = needsStateRestore();
  if (controlledComponentsHavePendingUpdates) {
    // If a controlled event was fired, we may need to restore the state of
    // the DOM node back to the controlled value. This is necessary when React
    // bails out of the update without touching the DOM.
    flushDiscreteUpdatesImpl();
    restoreStateIfNeeded();
  }
}

function batchedUpdates(fn, bookkeeping) {
  if (isInsideEventHandler) {
    // If we are currently inside another batch, we need to wait until it
    // fully completes before restoring state.
    return fn(bookkeeping);
  }
  isInsideEventHandler = true;
  try {
    return batchedUpdatesImpl(fn, bookkeeping);
  } finally {
    isInsideEventHandler = false;
    finishEventHandler();
  }
}

function batchedEventUpdates(fn, a, b) {
  if (isInsideEventHandler) {
    // If we are currently inside another batch, we need to wait until it
    // fully completes before restoring state.
    return fn(a, b);
  }
  isInsideEventHandler = true;
  try {
    return batchedEventUpdatesImpl(fn, a, b);
  } finally {
    isInsideEventHandler = false;
    finishEventHandler();
  }
}

function discreteUpdates(fn, a, b, c) {
  var prevIsInsideEventHandler = isInsideEventHandler;
  isInsideEventHandler = true;
  try {
    return discreteUpdatesImpl(fn, a, b, c);
  } finally {
    isInsideEventHandler = prevIsInsideEventHandler;
    if (!isInsideEventHandler) {
      finishEventHandler();
    }
  }
}

var lastFlushedEventTimeStamp = 0;
function flushDiscreteUpdatesIfNeeded(timeStamp) {
  // event.timeStamp isn't overly reliable due to inconsistencies in
  // how different browsers have historically provided the time stamp.
  // Some browsers provide high-resolution time stamps for all events,
  // some provide low-resolution time stamps for all events. FF < 52
  // even mixes both time stamps together. Some browsers even report
  // negative time stamps or time stamps that are 0 (iOS9) in some cases.
  // Given we are only comparing two time stamps with equality (!==),
  // we are safe from the resolution differences. If the time stamp is 0
  // we bail-out of preventing the flush, which can affect semantics,
  // such as if an earlier flush removes or adds event listeners that
  // are fired in the subsequent flush. However, this is the same
  // behaviour as we had before this change, so the risks are low.
  if (!isInsideEventHandler && (!enableFlareAPI || timeStamp === 0 || lastFlushedEventTimeStamp !== timeStamp)) {
    lastFlushedEventTimeStamp = timeStamp;
    flushDiscreteUpdatesImpl();
  }
}

function setBatchingImplementation(_batchedUpdatesImpl, _discreteUpdatesImpl, _flushDiscreteUpdatesImpl, _batchedEventUpdatesImpl) {
  batchedUpdatesImpl = _batchedUpdatesImpl;
  discreteUpdatesImpl = _discreteUpdatesImpl;
  flushDiscreteUpdatesImpl = _flushDiscreteUpdatesImpl;
  batchedEventUpdatesImpl = _batchedEventUpdatesImpl;
}