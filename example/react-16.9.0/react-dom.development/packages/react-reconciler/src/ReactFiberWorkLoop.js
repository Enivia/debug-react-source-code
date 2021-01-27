// The scheduler is imported here *only* to detect whether it's been mocked
// DEV stuff
var ceil = Math.ceil;

var ReactCurrentDispatcher = ReactSharedInternals.ReactCurrentDispatcher;
var ReactCurrentOwner$2 = ReactSharedInternals.ReactCurrentOwner;
var IsSomeRendererActing = ReactSharedInternals.IsSomeRendererActing;


var NoContext = /*                    */0;
var BatchedContext = /*               */1;
var EventContext = /*                 */2;
var DiscreteEventContext = /*         */4;
var LegacyUnbatchedContext = /*       */8;
var RenderContext = /*                */16;
var CommitContext = /*                */32;

var RootIncomplete = 0;
var RootErrored = 1;
var RootSuspended = 2;
var RootSuspendedWithDelay = 3;
var RootCompleted = 4;

// Describes where we are in the React execution stack
var executionContext = NoContext;
// The root we're working on
var workInProgressRoot = null;
// The fiber we're working on
var workInProgress = null;
// The expiration time we're rendering
var renderExpirationTime = NoWork;
// Whether to root completed, errored, suspended, etc.
var workInProgressRootExitStatus = RootIncomplete;
// Most recent event time among processed updates during this render.
// This is conceptually a time stamp but expressed in terms of an ExpirationTime
// because we deal mostly with expiration times in the hot path, so this avoids
// the conversion happening in the hot path.
var workInProgressRootLatestProcessedExpirationTime = Sync;
var workInProgressRootLatestSuspenseTimeout = Sync;
var workInProgressRootCanSuspendUsingConfig = null;
// If we're pinged while rendering we don't always restart immediately.
// This flag determines if it might be worthwhile to restart if an opportunity
// happens latere.
var workInProgressRootHasPendingPing = false;
// The most recent time we committed a fallback. This lets us ensure a train
// model where we don't commit new loading states in too quick succession.
var globalMostRecentFallbackTime = 0;
var FALLBACK_THROTTLE_MS = 500;

var nextEffect = null;
var hasUncaughtError = false;
var firstUncaughtError = null;
var legacyErrorBoundariesThatAlreadyFailed = null;

var rootDoesHavePassiveEffects = false;
var rootWithPendingPassiveEffects = null;
var pendingPassiveEffectsRenderPriority = NoPriority;
var pendingPassiveEffectsExpirationTime = NoWork;

var rootsWithPendingDiscreteUpdates = null;

// Use these to prevent an infinite loop of nested updates
var NESTED_UPDATE_LIMIT = 50;
var nestedUpdateCount = 0;
var rootWithNestedUpdates = null;

var NESTED_PASSIVE_UPDATE_LIMIT = 50;
var nestedPassiveUpdateCount = 0;

var interruptedBy = null;

// Marks the need to reschedule pending interactions at these expiration times
// during the commit phase. This enables them to be traced across components
// that spawn new work during render. E.g. hidden boundaries, suspended SSR
// hydration or SuspenseList.
var spawnedWorkDuringRender = null;

// Expiration times are computed by adding to the current time (the start
// time). However, if two updates are scheduled within the same event, we
// should treat their start times as simultaneous, even if the actual clock
// time has advanced between the first and second call.

// In other words, because expiration times determine how updates are batched,
// we want all updates of like priority that occur within the same event to
// receive the same expiration time. Otherwise we get tearing.
var currentEventTime = NoWork;

function requestCurrentTime() {
  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    // We're inside React, so it's fine to read the actual time.
    return msToExpirationTime(now());
  }
  // We're not inside React, so we may be in the middle of a browser event.
  if (currentEventTime !== NoWork) {
    // Use the same start time for all updates until we enter React again.
    return currentEventTime;
  }
  // This is the first update since React yielded. Compute a new start time.
  currentEventTime = msToExpirationTime(now());
  return currentEventTime;
}

function computeExpirationForFiber(currentTime, fiber, suspenseConfig) {
  var mode = fiber.mode;
  if ((mode & BatchedMode) === NoMode) {
    return Sync;
  }

  var priorityLevel = getCurrentPriorityLevel();
  if ((mode & ConcurrentMode) === NoMode) {
    return priorityLevel === ImmediatePriority ? Sync : Batched;
  }

  if ((executionContext & RenderContext) !== NoContext) {
    // Use whatever time we're already rendering
    return renderExpirationTime;
  }

  var expirationTime = void 0;
  if (suspenseConfig !== null) {
    // Compute an expiration time based on the Suspense timeout.
    expirationTime = computeSuspenseExpiration(currentTime, suspenseConfig.timeoutMs | 0 || LOW_PRIORITY_EXPIRATION);
  } else {
    // Compute an expiration time based on the Scheduler priority.
    switch (priorityLevel) {
      case ImmediatePriority:
        expirationTime = Sync;
        break;
      case UserBlockingPriority$2:
        // TODO: Rename this to computeUserBlockingExpiration
        expirationTime = computeInteractiveExpiration(currentTime);
        break;
      case NormalPriority:
      case LowPriority:
        // TODO: Handle LowPriority
        // TODO: Rename this to... something better.
        expirationTime = computeAsyncExpiration(currentTime);
        break;
      case IdlePriority:
        expirationTime = Never;
        break;
      default:
        (function () {
          {
            {
              throw ReactError(Error('Expected a valid priority level'));
            }
          }
        })();
    }
  }

  // If we're in the middle of rendering a tree, do not update at the same
  // expiration time that is already rendering.
  // TODO: We shouldn't have to do this if the update is on a different root.
  // Refactor computeExpirationForFiber + scheduleUpdate so we have access to
  // the root when we check for this condition.
  if (workInProgressRoot !== null && expirationTime === renderExpirationTime) {
    // This is a trick to move this update into a separate batch
    expirationTime -= 1;
  }

  return expirationTime;
}

var lastUniqueAsyncExpiration = NoWork;
function computeUniqueAsyncExpiration() {
  var currentTime = requestCurrentTime();
  var result = computeAsyncExpiration(currentTime);
  if (result <= lastUniqueAsyncExpiration) {
    // Since we assume the current time monotonically increases, we only hit
    // this branch when computeUniqueAsyncExpiration is fired multiple times
    // within a 200ms window (or whatever the async bucket size is).
    result -= 1;
  }
  lastUniqueAsyncExpiration = result;
  return result;
}

function scheduleUpdateOnFiber(fiber, expirationTime) {
  checkForNestedUpdates();
  warnAboutInvalidUpdatesOnClassComponentsInDEV(fiber);

  var root = markUpdateTimeFromFiberToRoot(fiber, expirationTime);
  if (root === null) {
    warnAboutUpdateOnUnmountedFiberInDEV(fiber);
    return;
  }

  root.pingTime = NoWork;

  checkForInterruption(fiber, expirationTime);
  recordScheduleUpdate();

  // TODO: computeExpirationForFiber also reads the priority. Pass the
  // priority as an argument to that function and this one.
  var priorityLevel = getCurrentPriorityLevel();

  if (expirationTime === Sync) {
    if (
    // Check if we're inside unbatchedUpdates
    (executionContext & LegacyUnbatchedContext) !== NoContext &&
    // Check if we're not already rendering
    (executionContext & (RenderContext | CommitContext)) === NoContext) {
      // Register pending interactions on the root to avoid losing traced interaction data.
      schedulePendingInteractions(root, expirationTime);

      // This is a legacy edge case. The initial mount of a ReactDOM.render-ed
      // root inside of batchedUpdates should be synchronous, but layout updates
      // should be deferred until the end of the batch.
      var callback = renderRoot(root, Sync, true);
      while (callback !== null) {
        callback = callback(true);
      }
    } else {
      scheduleCallbackForRoot(root, ImmediatePriority, Sync);
      if (executionContext === NoContext) {
        // Flush the synchronous work now, wnless we're already working or inside
        // a batch. This is intentionally inside scheduleUpdateOnFiber instead of
        // scheduleCallbackForFiber to preserve the ability to schedule a callback
        // without immediately flushing it. We only do this for user-initiated
        // updates, to preserve historical behavior of sync mode.
        flushSyncCallbackQueue();
      }
    }
  } else {
    scheduleCallbackForRoot(root, priorityLevel, expirationTime);
  }

  if ((executionContext & DiscreteEventContext) !== NoContext && (
  // Only updates at user-blocking priority or greater are considered
  // discrete, even inside a discrete event.
  priorityLevel === UserBlockingPriority$2 || priorityLevel === ImmediatePriority)) {
    // This is the result of a discrete event. Track the lowest priority
    // discrete update per root so we can flush them early, if needed.
    if (rootsWithPendingDiscreteUpdates === null) {
      rootsWithPendingDiscreteUpdates = new Map([[root, expirationTime]]);
    } else {
      var lastDiscreteTime = rootsWithPendingDiscreteUpdates.get(root);
      if (lastDiscreteTime === undefined || lastDiscreteTime > expirationTime) {
        rootsWithPendingDiscreteUpdates.set(root, expirationTime);
      }
    }
  }
}
var scheduleWork = scheduleUpdateOnFiber;

// This is split into a separate function so we can mark a fiber with pending
// work without treating it as a typical update that originates from an event;
// e.g. retrying a Suspense boundary isn't an update, but it does schedule work
// on a fiber.
function markUpdateTimeFromFiberToRoot(fiber, expirationTime) {
  // Update the source fiber's expiration time
  if (fiber.expirationTime < expirationTime) {
    fiber.expirationTime = expirationTime;
  }
  var alternate = fiber.alternate;
  if (alternate !== null && alternate.expirationTime < expirationTime) {
    alternate.expirationTime = expirationTime;
  }
  // Walk the parent path to the root and update the child expiration time.
  var node = fiber.return;
  var root = null;
  if (node === null && fiber.tag === HostRoot) {
    root = fiber.stateNode;
  } else {
    while (node !== null) {
      alternate = node.alternate;
      if (node.childExpirationTime < expirationTime) {
        node.childExpirationTime = expirationTime;
        if (alternate !== null && alternate.childExpirationTime < expirationTime) {
          alternate.childExpirationTime = expirationTime;
        }
      } else if (alternate !== null && alternate.childExpirationTime < expirationTime) {
        alternate.childExpirationTime = expirationTime;
      }
      if (node.return === null && node.tag === HostRoot) {
        root = node.stateNode;
        break;
      }
      node = node.return;
    }
  }

  if (root !== null) {
    // Update the first and last pending expiration times in this root
    var firstPendingTime = root.firstPendingTime;
    if (expirationTime > firstPendingTime) {
      root.firstPendingTime = expirationTime;
    }
    var lastPendingTime = root.lastPendingTime;
    if (lastPendingTime === NoWork || expirationTime < lastPendingTime) {
      root.lastPendingTime = expirationTime;
    }
  }

  return root;
}

// Use this function, along with runRootCallback, to ensure that only a single
// callback per root is scheduled. It's still possible to call renderRoot
// directly, but scheduling via this function helps avoid excessive callbacks.
// It works by storing the callback node and expiration time on the root. When a
// new callback comes in, it compares the expiration time to determine if it
// should cancel the previous one. It also relies on commitRoot scheduling a
// callback to render the next level, because that means we don't need a
// separate callback per expiration time.
function scheduleCallbackForRoot(root, priorityLevel, expirationTime) {
  var existingCallbackExpirationTime = root.callbackExpirationTime;
  if (existingCallbackExpirationTime < expirationTime) {
    // New callback has higher priority than the existing one.
    var existingCallbackNode = root.callbackNode;
    if (existingCallbackNode !== null) {
      cancelCallback(existingCallbackNode);
    }
    root.callbackExpirationTime = expirationTime;

    if (expirationTime === Sync) {
      // Sync React callbacks are scheduled on a special internal queue
      root.callbackNode = scheduleSyncCallback(runRootCallback.bind(null, root, renderRoot.bind(null, root, expirationTime)));
    } else {
      var options = null;
      if (!disableSchedulerTimeoutBasedOnReactExpirationTime && expirationTime !== Never) {
        var timeout = expirationTimeToMs(expirationTime) - now();
        options = { timeout: timeout };
      }

      root.callbackNode = scheduleCallback(priorityLevel, runRootCallback.bind(null, root, renderRoot.bind(null, root, expirationTime)), options);
      if (enableUserTimingAPI && expirationTime !== Sync && (executionContext & (RenderContext | CommitContext)) === NoContext) {
        // Scheduled an async callback, and we're not already working. Add an
        // entry to the flamegraph that shows we're waiting for a callback
        // to fire.
        startRequestCallbackTimer();
      }
    }
  }

  // Associate the current interactions with this new root+priority.
  schedulePendingInteractions(root, expirationTime);
}

function runRootCallback(root, callback, isSync) {
  var prevCallbackNode = root.callbackNode;
  var continuation = null;
  try {
    continuation = callback(isSync);
    if (continuation !== null) {
      return runRootCallback.bind(null, root, continuation);
    } else {
      return null;
    }
  } finally {
    // If the callback exits without returning a continuation, remove the
    // corresponding callback node from the root. Unless the callback node
    // has changed, which implies that it was already cancelled by a high
    // priority update.
    if (continuation === null && prevCallbackNode === root.callbackNode) {
      root.callbackNode = null;
      root.callbackExpirationTime = NoWork;
    }
  }
}

function flushRoot(root, expirationTime) {
  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    (function () {
      {
        {
          throw ReactError(Error('work.commit(): Cannot commit while already rendering. This likely means you attempted to commit from inside a lifecycle method.'));
        }
      }
    })();
  }
  scheduleSyncCallback(renderRoot.bind(null, root, expirationTime));
  flushSyncCallbackQueue();
}

function flushDiscreteUpdates() {
  // TODO: Should be able to flush inside batchedUpdates, but not inside `act`.
  // However, `act` uses `batchedUpdates`, so there's no way to distinguish
  // those two cases. Need to fix this before exposing flushDiscreteUpdates
  // as a public API.
  if ((executionContext & (BatchedContext | RenderContext | CommitContext)) !== NoContext) {
    if (true && (executionContext & RenderContext) !== NoContext) {
      warning$1(false, 'unstable_flushDiscreteUpdates: Cannot flush updates when React is ' + 'already rendering.');
    }
    // We're already rendering, so we can't synchronously flush pending work.
    // This is probably a nested event dispatch triggered by a lifecycle/effect,
    // like `el.focus()`. Exit.
    return;
  }
  flushPendingDiscreteUpdates();
  if (!revertPassiveEffectsChange) {
    // If the discrete updates scheduled passive effects, flush them now so that
    // they fire before the next serial event.
    flushPassiveEffects();
  }
}

function resolveLocksOnRoot(root, expirationTime) {
  var firstBatch = root.firstBatch;
  if (firstBatch !== null && firstBatch._defer && firstBatch._expirationTime >= expirationTime) {
    scheduleCallback(NormalPriority, function () {
      firstBatch._onComplete();
      return null;
    });
    return true;
  } else {
    return false;
  }
}





function flushPendingDiscreteUpdates() {
  if (rootsWithPendingDiscreteUpdates !== null) {
    // For each root with pending discrete updates, schedule a callback to
    // immediately flush them.
    var roots = rootsWithPendingDiscreteUpdates;
    rootsWithPendingDiscreteUpdates = null;
    roots.forEach(function (expirationTime, root) {
      scheduleSyncCallback(renderRoot.bind(null, root, expirationTime));
    });
    // Now flush the immediate queue.
    flushSyncCallbackQueue();
  }
}

function batchedUpdates$1(fn, a) {
  var prevExecutionContext = executionContext;
  executionContext |= BatchedContext;
  try {
    return fn(a);
  } finally {
    executionContext = prevExecutionContext;
    if (executionContext === NoContext) {
      // Flush the immediate callbacks that were scheduled during this batch
      flushSyncCallbackQueue();
    }
  }
}

function batchedEventUpdates$1(fn, a) {
  var prevExecutionContext = executionContext;
  executionContext |= EventContext;
  try {
    return fn(a);
  } finally {
    executionContext = prevExecutionContext;
    if (executionContext === NoContext) {
      // Flush the immediate callbacks that were scheduled during this batch
      flushSyncCallbackQueue();
    }
  }
}

function discreteUpdates$1(fn, a, b, c) {
  var prevExecutionContext = executionContext;
  executionContext |= DiscreteEventContext;
  try {
    // Should this
    return runWithPriority$2(UserBlockingPriority$2, fn.bind(null, a, b, c));
  } finally {
    executionContext = prevExecutionContext;
    if (executionContext === NoContext) {
      // Flush the immediate callbacks that were scheduled during this batch
      flushSyncCallbackQueue();
    }
  }
}

function unbatchedUpdates(fn, a) {
  var prevExecutionContext = executionContext;
  executionContext &= ~BatchedContext;
  executionContext |= LegacyUnbatchedContext;
  try {
    return fn(a);
  } finally {
    executionContext = prevExecutionContext;
    if (executionContext === NoContext) {
      // Flush the immediate callbacks that were scheduled during this batch
      flushSyncCallbackQueue();
    }
  }
}

function flushSync(fn, a) {
  if ((executionContext & (RenderContext | CommitContext)) !== NoContext) {
    (function () {
      {
        {
          throw ReactError(Error('flushSync was called from inside a lifecycle method. It cannot be called when React is already rendering.'));
        }
      }
    })();
  }
  var prevExecutionContext = executionContext;
  executionContext |= BatchedContext;
  try {
    return runWithPriority$2(ImmediatePriority, fn.bind(null, a));
  } finally {
    executionContext = prevExecutionContext;
    // Flush the immediate callbacks that were scheduled during this batch.
    // Note that this will happen even if batchedUpdates is higher up
    // the stack.
    flushSyncCallbackQueue();
  }
}

function flushControlled(fn) {
  var prevExecutionContext = executionContext;
  executionContext |= BatchedContext;
  try {
    runWithPriority$2(ImmediatePriority, fn);
  } finally {
    executionContext = prevExecutionContext;
    if (executionContext === NoContext) {
      // Flush the immediate callbacks that were scheduled during this batch
      flushSyncCallbackQueue();
    }
  }
}

function prepareFreshStack(root, expirationTime) {
  root.finishedWork = null;
  root.finishedExpirationTime = NoWork;

  var timeoutHandle = root.timeoutHandle;
  if (timeoutHandle !== noTimeout) {
    // The root previous suspended and scheduled a timeout to commit a fallback
    // state. Now that we have additional work, cancel the timeout.
    root.timeoutHandle = noTimeout;
    // $FlowFixMe Complains noTimeout is not a TimeoutID, despite the check above
    cancelTimeout(timeoutHandle);
  }

  if (workInProgress !== null) {
    var interruptedWork = workInProgress.return;
    while (interruptedWork !== null) {
      unwindInterruptedWork(interruptedWork);
      interruptedWork = interruptedWork.return;
    }
  }
  workInProgressRoot = root;
  workInProgress = createWorkInProgress(root.current, null, expirationTime);
  renderExpirationTime = expirationTime;
  workInProgressRootExitStatus = RootIncomplete;
  workInProgressRootLatestProcessedExpirationTime = Sync;
  workInProgressRootLatestSuspenseTimeout = Sync;
  workInProgressRootCanSuspendUsingConfig = null;
  workInProgressRootHasPendingPing = false;

  if (enableSchedulerTracing) {
    spawnedWorkDuringRender = null;
  }

  {
    ReactStrictModeWarnings.discardPendingWarnings();
    componentsThatTriggeredHighPriSuspend = null;
  }
}

function renderRoot(root, expirationTime, isSync) {
  (function () {
    if (!((executionContext & (RenderContext | CommitContext)) === NoContext)) {
      {
        throw ReactError(Error('Should not already be working.'));
      }
    }
  })();

  if (enableUserTimingAPI && expirationTime !== Sync) {
    var didExpire = isSync;
    stopRequestCallbackTimer(didExpire);
  }

  if (root.firstPendingTime < expirationTime) {
    // If there's no work left at this expiration time, exit immediately. This
    // happens when multiple callbacks are scheduled for a single root, but an
    // earlier callback flushes the work of a later one.
    return null;
  }

  if (isSync && root.finishedExpirationTime === expirationTime) {
    // There's already a pending commit at this expiration time.
    // TODO: This is poorly factored. This case only exists for the
    // batch.commit() API.
    return commitRoot.bind(null, root);
  }

  flushPassiveEffects();

  // If the root or expiration time have changed, throw out the existing stack
  // and prepare a fresh one. Otherwise we'll continue where we left off.
  if (root !== workInProgressRoot || expirationTime !== renderExpirationTime) {
    prepareFreshStack(root, expirationTime);
    startWorkOnPendingInteractions(root, expirationTime);
  } else if (workInProgressRootExitStatus === RootSuspendedWithDelay) {
    // We could've received an update at a lower priority while we yielded.
    // We're suspended in a delayed state. Once we complete this render we're
    // just going to try to recover at the last pending time anyway so we might
    // as well start doing that eagerly.
    // Ideally we should be able to do this even for retries but we don't yet
    // know if we're going to process an update which wants to commit earlier,
    // and this path happens very early so it would happen too often. Instead,
    // for that case, we'll wait until we complete.
    if (workInProgressRootHasPendingPing) {
      // We have a ping at this expiration. Let's restart to see if we get unblocked.
      prepareFreshStack(root, expirationTime);
    } else {
      var lastPendingTime = root.lastPendingTime;
      if (lastPendingTime < expirationTime) {
        // There's lower priority work. It might be unsuspended. Try rendering
        // at that level immediately, while preserving the position in the queue.
        return renderRoot.bind(null, root, lastPendingTime);
      }
    }
  }

  // If we have a work-in-progress fiber, it means there's still work to do
  // in this root.
  if (workInProgress !== null) {
    var prevExecutionContext = executionContext;
    executionContext |= RenderContext;
    var prevDispatcher = ReactCurrentDispatcher.current;
    if (prevDispatcher === null) {
      // The React isomorphic package does not include a default dispatcher.
      // Instead the first renderer will lazily attach one, in order to give
      // nicer error messages.
      prevDispatcher = ContextOnlyDispatcher;
    }
    ReactCurrentDispatcher.current = ContextOnlyDispatcher;
    var prevInteractions = null;
    if (enableSchedulerTracing) {
      prevInteractions = __interactionsRef.current;
      __interactionsRef.current = root.memoizedInteractions;
    }

    startWorkLoopTimer(workInProgress);

    // TODO: Fork renderRoot into renderRootSync and renderRootAsync
    if (isSync) {
      if (expirationTime !== Sync) {
        // An async update expired. There may be other expired updates on
        // this root. We should render all the expired work in a
        // single batch.
        var currentTime = requestCurrentTime();
        if (currentTime < expirationTime) {
          // Restart at the current time.
          executionContext = prevExecutionContext;
          resetContextDependencies();
          ReactCurrentDispatcher.current = prevDispatcher;
          if (enableSchedulerTracing) {
            __interactionsRef.current = prevInteractions;
          }
          return renderRoot.bind(null, root, currentTime);
        }
      }
    } else {
      // Since we know we're in a React event, we can clear the current
      // event time. The next update will compute a new event time.
      currentEventTime = NoWork;
    }

    do {
      try {
        if (isSync) {
          workLoopSync();
        } else {
          workLoop();
        }
        break;
      } catch (thrownValue) {
        // Reset module-level state that was set during the render phase.
        resetContextDependencies();
        resetHooks();

        var sourceFiber = workInProgress;
        if (sourceFiber === null || sourceFiber.return === null) {
          // Expected to be working on a non-root fiber. This is a fatal error
          // because there's no ancestor that can handle it; the root is
          // supposed to capture all errors that weren't caught by an error
          // boundary.
          prepareFreshStack(root, expirationTime);
          executionContext = prevExecutionContext;
          throw thrownValue;
        }

        if (enableProfilerTimer && sourceFiber.mode & ProfileMode) {
          // Record the time spent rendering before an error was thrown. This
          // avoids inaccurate Profiler durations in the case of a
          // suspended render.
          stopProfilerTimerIfRunningAndRecordDelta(sourceFiber, true);
        }

        var returnFiber = sourceFiber.return;
        throwException(root, returnFiber, sourceFiber, thrownValue, renderExpirationTime);
        workInProgress = completeUnitOfWork(sourceFiber);
      }
    } while (true);

    executionContext = prevExecutionContext;
    resetContextDependencies();
    ReactCurrentDispatcher.current = prevDispatcher;
    if (enableSchedulerTracing) {
      __interactionsRef.current = prevInteractions;
    }

    if (workInProgress !== null) {
      // There's still work left over. Return a continuation.
      stopInterruptedWorkLoopTimer();
      if (expirationTime !== Sync) {
        startRequestCallbackTimer();
      }
      return renderRoot.bind(null, root, expirationTime);
    }
  }

  // We now have a consistent tree. The next step is either to commit it, or, if
  // something suspended, wait to commit it after a timeout.
  stopFinishedWorkLoopTimer();

  root.finishedWork = root.current.alternate;
  root.finishedExpirationTime = expirationTime;

  var isLocked = resolveLocksOnRoot(root, expirationTime);
  if (isLocked) {
    // This root has a lock that prevents it from committing. Exit. If we begin
    // work on the root again, without any intervening updates, it will finish
    // without doing additional work.
    return null;
  }

  // Set this to null to indicate there's no in-progress render.
  workInProgressRoot = null;

  switch (workInProgressRootExitStatus) {
    case RootIncomplete:
      {
        (function () {
          {
            {
              throw ReactError(Error('Should have a work-in-progress.'));
            }
          }
        })();
      }
    // Flow knows about invariant, so it complains if I add a break statement,
    // but eslint doesn't know about invariant, so it complains if I do.
    // eslint-disable-next-line no-fallthrough
    case RootErrored:
      {
        // An error was thrown. First check if there is lower priority work
        // scheduled on this root.
        var _lastPendingTime = root.lastPendingTime;
        if (_lastPendingTime < expirationTime) {
          // There's lower priority work. Before raising the error, try rendering
          // at the lower priority to see if it fixes it. Use a continuation to
          // maintain the existing priority and position in the queue.
          return renderRoot.bind(null, root, _lastPendingTime);
        }
        if (!isSync) {
          // If we're rendering asynchronously, it's possible the error was
          // caused by tearing due to a mutation during an event. Try rendering
          // one more time without yiedling to events.
          prepareFreshStack(root, expirationTime);
          scheduleSyncCallback(renderRoot.bind(null, root, expirationTime));
          return null;
        }
        // If we're already rendering synchronously, commit the root in its
        // errored state.
        return commitRoot.bind(null, root);
      }
    case RootSuspended:
      {
        flushSuspensePriorityWarningInDEV();

        // We have an acceptable loading state. We need to figure out if we should
        // immediately commit it or wait a bit.

        // If we have processed new updates during this render, we may now have a
        // new loading state ready. We want to ensure that we commit that as soon as
        // possible.
        var hasNotProcessedNewUpdates = workInProgressRootLatestProcessedExpirationTime === Sync;
        if (hasNotProcessedNewUpdates && !isSync &&
        // do not delay if we're inside an act() scope
        !(true && flushSuspenseFallbacksInTests && IsThisRendererActing.current)) {
          // If we have not processed any new updates during this pass, then this is
          // either a retry of an existing fallback state or a hidden tree.
          // Hidden trees shouldn't be batched with other work and after that's
          // fixed it can only be a retry.
          // We're going to throttle committing retries so that we don't show too
          // many loading states too quickly.
          var msUntilTimeout = globalMostRecentFallbackTime + FALLBACK_THROTTLE_MS - now();
          // Don't bother with a very short suspense time.
          if (msUntilTimeout > 10) {
            if (workInProgressRootHasPendingPing) {
              // This render was pinged but we didn't get to restart earlier so try
              // restarting now instead.
              prepareFreshStack(root, expirationTime);
              return renderRoot.bind(null, root, expirationTime);
            }
            var _lastPendingTime2 = root.lastPendingTime;
            if (_lastPendingTime2 < expirationTime) {
              // There's lower priority work. It might be unsuspended. Try rendering
              // at that level.
              return renderRoot.bind(null, root, _lastPendingTime2);
            }
            // The render is suspended, it hasn't timed out, and there's no lower
            // priority work to do. Instead of committing the fallback
            // immediately, wait for more data to arrive.
            root.timeoutHandle = scheduleTimeout(commitRoot.bind(null, root), msUntilTimeout);
            return null;
          }
        }
        // The work expired. Commit immediately.
        return commitRoot.bind(null, root);
      }
    case RootSuspendedWithDelay:
      {
        flushSuspensePriorityWarningInDEV();

        if (!isSync &&
        // do not delay if we're inside an act() scope
        !(true && flushSuspenseFallbacksInTests && IsThisRendererActing.current)) {
          // We're suspended in a state that should be avoided. We'll try to avoid committing
          // it for as long as the timeouts let us.
          if (workInProgressRootHasPendingPing) {
            // This render was pinged but we didn't get to restart earlier so try
            // restarting now instead.
            prepareFreshStack(root, expirationTime);
            return renderRoot.bind(null, root, expirationTime);
          }
          var _lastPendingTime3 = root.lastPendingTime;
          if (_lastPendingTime3 < expirationTime) {
            // There's lower priority work. It might be unsuspended. Try rendering
            // at that level immediately.
            return renderRoot.bind(null, root, _lastPendingTime3);
          }

          var _msUntilTimeout = void 0;
          if (workInProgressRootLatestSuspenseTimeout !== Sync) {
            // We have processed a suspense config whose expiration time we can use as
            // the timeout.
            _msUntilTimeout = expirationTimeToMs(workInProgressRootLatestSuspenseTimeout) - now();
          } else if (workInProgressRootLatestProcessedExpirationTime === Sync) {
            // This should never normally happen because only new updates cause
            // delayed states, so we should have processed something. However,
            // this could also happen in an offscreen tree.
            _msUntilTimeout = 0;
          } else {
            // If we don't have a suspense config, we're going to use a heuristic to
            var eventTimeMs = inferTimeFromExpirationTime(workInProgressRootLatestProcessedExpirationTime);
            var currentTimeMs = now();
            var timeUntilExpirationMs = expirationTimeToMs(expirationTime) - currentTimeMs;
            var timeElapsed = currentTimeMs - eventTimeMs;
            if (timeElapsed < 0) {
              // We get this wrong some time since we estimate the time.
              timeElapsed = 0;
            }

            _msUntilTimeout = jnd(timeElapsed) - timeElapsed;

            // Clamp the timeout to the expiration time.
            // TODO: Once the event time is exact instead of inferred from expiration time
            // we don't need this.
            if (timeUntilExpirationMs < _msUntilTimeout) {
              _msUntilTimeout = timeUntilExpirationMs;
            }
          }

          // Don't bother with a very short suspense time.
          if (_msUntilTimeout > 10) {
            // The render is suspended, it hasn't timed out, and there's no lower
            // priority work to do. Instead of committing the fallback
            // immediately, wait for more data to arrive.
            root.timeoutHandle = scheduleTimeout(commitRoot.bind(null, root), _msUntilTimeout);
            return null;
          }
        }
        // The work expired. Commit immediately.
        return commitRoot.bind(null, root);
      }
    case RootCompleted:
      {
        // The work completed. Ready to commit.
        if (!isSync &&
        // do not delay if we're inside an act() scope
        !(true && flushSuspenseFallbacksInTests && IsThisRendererActing.current) && workInProgressRootLatestProcessedExpirationTime !== Sync && workInProgressRootCanSuspendUsingConfig !== null) {
          // If we have exceeded the minimum loading delay, which probably
          // means we have shown a spinner already, we might have to suspend
          // a bit longer to ensure that the spinner is shown for enough time.
          var _msUntilTimeout2 = computeMsUntilSuspenseLoadingDelay(workInProgressRootLatestProcessedExpirationTime, expirationTime, workInProgressRootCanSuspendUsingConfig);
          if (_msUntilTimeout2 > 10) {
            root.timeoutHandle = scheduleTimeout(commitRoot.bind(null, root), _msUntilTimeout2);
            return null;
          }
        }
        return commitRoot.bind(null, root);
      }
    default:
      {
        (function () {
          {
            {
              throw ReactError(Error('Unknown root exit status.'));
            }
          }
        })();
      }
  }
}

function markCommitTimeOfFallback() {
  globalMostRecentFallbackTime = now();
}

function markRenderEventTimeAndConfig(expirationTime, suspenseConfig) {
  if (expirationTime < workInProgressRootLatestProcessedExpirationTime && expirationTime > Never) {
    workInProgressRootLatestProcessedExpirationTime = expirationTime;
  }
  if (suspenseConfig !== null) {
    if (expirationTime < workInProgressRootLatestSuspenseTimeout && expirationTime > Never) {
      workInProgressRootLatestSuspenseTimeout = expirationTime;
      // Most of the time we only have one config and getting wrong is not bad.
      workInProgressRootCanSuspendUsingConfig = suspenseConfig;
    }
  }
}

function renderDidSuspend() {
  if (workInProgressRootExitStatus === RootIncomplete) {
    workInProgressRootExitStatus = RootSuspended;
  }
}

function renderDidSuspendDelayIfPossible() {
  if (workInProgressRootExitStatus === RootIncomplete || workInProgressRootExitStatus === RootSuspended) {
    workInProgressRootExitStatus = RootSuspendedWithDelay;
  }
}

function renderDidError() {
  if (workInProgressRootExitStatus !== RootCompleted) {
    workInProgressRootExitStatus = RootErrored;
  }
}

// Called during render to determine if anything has suspended.
// Returns false if we're not sure.
function renderHasNotSuspendedYet() {
  // If something errored or completed, we can't really be sure,
  // so those are false.
  return workInProgressRootExitStatus === RootIncomplete;
}

function inferTimeFromExpirationTime(expirationTime) {
  // We don't know exactly when the update was scheduled, but we can infer an
  // approximate start time from the expiration time.
  var earliestExpirationTimeMs = expirationTimeToMs(expirationTime);
  return earliestExpirationTimeMs - LOW_PRIORITY_EXPIRATION;
}

function inferTimeFromExpirationTimeWithSuspenseConfig(expirationTime, suspenseConfig) {
  // We don't know exactly when the update was scheduled, but we can infer an
  // approximate start time from the expiration time by subtracting the timeout
  // that was added to the event time.
  var earliestExpirationTimeMs = expirationTimeToMs(expirationTime);
  return earliestExpirationTimeMs - (suspenseConfig.timeoutMs | 0 || LOW_PRIORITY_EXPIRATION);
}

function workLoopSync() {
  // Already timed out, so perform work without checking if we need to yield.
  while (workInProgress !== null) {
    workInProgress = performUnitOfWork(workInProgress);
  }
}

function workLoop() {
  // Perform work until Scheduler asks us to yield
  while (workInProgress !== null && !shouldYield()) {
    workInProgress = performUnitOfWork(workInProgress);
  }
}

function performUnitOfWork(unitOfWork) {
  // The current, flushed, state of this fiber is the alternate. Ideally
  // nothing should rely on this, but relying on it here means that we don't
  // need an additional field on the work in progress.
  var current$$1 = unitOfWork.alternate;

  startWorkTimer(unitOfWork);
  setCurrentFiber(unitOfWork);

  var next = void 0;
  if (enableProfilerTimer && (unitOfWork.mode & ProfileMode) !== NoMode) {
    startProfilerTimer(unitOfWork);
    next = beginWork$$1(current$$1, unitOfWork, renderExpirationTime);
    stopProfilerTimerIfRunningAndRecordDelta(unitOfWork, true);
  } else {
    next = beginWork$$1(current$$1, unitOfWork, renderExpirationTime);
  }

  resetCurrentFiber();
  unitOfWork.memoizedProps = unitOfWork.pendingProps;
  if (next === null) {
    // If this doesn't spawn new work, complete the current work.
    next = completeUnitOfWork(unitOfWork);
  }

  ReactCurrentOwner$2.current = null;
  return next;
}

function completeUnitOfWork(unitOfWork) {
  // Attempt to complete the current unit of work, then move to the next
  // sibling. If there are no more siblings, return to the parent fiber.
  workInProgress = unitOfWork;
  do {
    // The current, flushed, state of this fiber is the alternate. Ideally
    // nothing should rely on this, but relying on it here means that we don't
    // need an additional field on the work in progress.
    var current$$1 = workInProgress.alternate;
    var returnFiber = workInProgress.return;

    // Check if the work completed or if something threw.
    if ((workInProgress.effectTag & Incomplete) === NoEffect) {
      setCurrentFiber(workInProgress);
      var next = void 0;
      if (!enableProfilerTimer || (workInProgress.mode & ProfileMode) === NoMode) {
        next = completeWork(current$$1, workInProgress, renderExpirationTime);
      } else {
        startProfilerTimer(workInProgress);
        next = completeWork(current$$1, workInProgress, renderExpirationTime);
        // Update render duration assuming we didn't error.
        stopProfilerTimerIfRunningAndRecordDelta(workInProgress, false);
      }
      stopWorkTimer(workInProgress);
      resetCurrentFiber();
      resetChildExpirationTime(workInProgress);

      if (next !== null) {
        // Completing this fiber spawned new work. Work on that next.
        return next;
      }

      if (returnFiber !== null &&
      // Do not append effects to parents if a sibling failed to complete
      (returnFiber.effectTag & Incomplete) === NoEffect) {
        // Append all the effects of the subtree and this fiber onto the effect
        // list of the parent. The completion order of the children affects the
        // side-effect order.
        if (returnFiber.firstEffect === null) {
          returnFiber.firstEffect = workInProgress.firstEffect;
        }
        if (workInProgress.lastEffect !== null) {
          if (returnFiber.lastEffect !== null) {
            returnFiber.lastEffect.nextEffect = workInProgress.firstEffect;
          }
          returnFiber.lastEffect = workInProgress.lastEffect;
        }

        // If this fiber had side-effects, we append it AFTER the children's
        // side-effects. We can perform certain side-effects earlier if needed,
        // by doing multiple passes over the effect list. We don't want to
        // schedule our own side-effect on our own list because if end up
        // reusing children we'll schedule this effect onto itself since we're
        // at the end.
        var effectTag = workInProgress.effectTag;

        // Skip both NoWork and PerformedWork tags when creating the effect
        // list. PerformedWork effect is read by React DevTools but shouldn't be
        // committed.
        if (effectTag > PerformedWork) {
          if (returnFiber.lastEffect !== null) {
            returnFiber.lastEffect.nextEffect = workInProgress;
          } else {
            returnFiber.firstEffect = workInProgress;
          }
          returnFiber.lastEffect = workInProgress;
        }
      }
    } else {
      // This fiber did not complete because something threw. Pop values off
      // the stack without entering the complete phase. If this is a boundary,
      // capture values if possible.
      var _next = unwindWork(workInProgress, renderExpirationTime);

      // Because this fiber did not complete, don't reset its expiration time.

      if (enableProfilerTimer && (workInProgress.mode & ProfileMode) !== NoMode) {
        // Record the render duration for the fiber that errored.
        stopProfilerTimerIfRunningAndRecordDelta(workInProgress, false);

        // Include the time spent working on failed children before continuing.
        var actualDuration = workInProgress.actualDuration;
        var child = workInProgress.child;
        while (child !== null) {
          actualDuration += child.actualDuration;
          child = child.sibling;
        }
        workInProgress.actualDuration = actualDuration;
      }

      if (_next !== null) {
        // If completing this work spawned new work, do that next. We'll come
        // back here again.
        // Since we're restarting, remove anything that is not a host effect
        // from the effect tag.
        // TODO: The name stopFailedWorkTimer is misleading because Suspense
        // also captures and restarts.
        stopFailedWorkTimer(workInProgress);
        _next.effectTag &= HostEffectMask;
        return _next;
      }
      stopWorkTimer(workInProgress);

      if (returnFiber !== null) {
        // Mark the parent fiber as incomplete and clear its effect list.
        returnFiber.firstEffect = returnFiber.lastEffect = null;
        returnFiber.effectTag |= Incomplete;
      }
    }

    var siblingFiber = workInProgress.sibling;
    if (siblingFiber !== null) {
      // If there is more work to do in this returnFiber, do that next.
      return siblingFiber;
    }
    // Otherwise, return to the parent
    workInProgress = returnFiber;
  } while (workInProgress !== null);

  // We've reached the root.
  if (workInProgressRootExitStatus === RootIncomplete) {
    workInProgressRootExitStatus = RootCompleted;
  }
  return null;
}

function resetChildExpirationTime(completedWork) {
  if (renderExpirationTime !== Never && completedWork.childExpirationTime === Never) {
    // The children of this component are hidden. Don't bubble their
    // expiration times.
    return;
  }

  var newChildExpirationTime = NoWork;

  // Bubble up the earliest expiration time.
  if (enableProfilerTimer && (completedWork.mode & ProfileMode) !== NoMode) {
    // In profiling mode, resetChildExpirationTime is also used to reset
    // profiler durations.
    var actualDuration = completedWork.actualDuration;
    var treeBaseDuration = completedWork.selfBaseDuration;

    // When a fiber is cloned, its actualDuration is reset to 0. This value will
    // only be updated if work is done on the fiber (i.e. it doesn't bailout).
    // When work is done, it should bubble to the parent's actualDuration. If
    // the fiber has not been cloned though, (meaning no work was done), then
    // this value will reflect the amount of time spent working on a previous
    // render. In that case it should not bubble. We determine whether it was
    // cloned by comparing the child pointer.
    var shouldBubbleActualDurations = completedWork.alternate === null || completedWork.child !== completedWork.alternate.child;

    var child = completedWork.child;
    while (child !== null) {
      var childUpdateExpirationTime = child.expirationTime;
      var childChildExpirationTime = child.childExpirationTime;
      if (childUpdateExpirationTime > newChildExpirationTime) {
        newChildExpirationTime = childUpdateExpirationTime;
      }
      if (childChildExpirationTime > newChildExpirationTime) {
        newChildExpirationTime = childChildExpirationTime;
      }
      if (shouldBubbleActualDurations) {
        actualDuration += child.actualDuration;
      }
      treeBaseDuration += child.treeBaseDuration;
      child = child.sibling;
    }
    completedWork.actualDuration = actualDuration;
    completedWork.treeBaseDuration = treeBaseDuration;
  } else {
    var _child = completedWork.child;
    while (_child !== null) {
      var _childUpdateExpirationTime = _child.expirationTime;
      var _childChildExpirationTime = _child.childExpirationTime;
      if (_childUpdateExpirationTime > newChildExpirationTime) {
        newChildExpirationTime = _childUpdateExpirationTime;
      }
      if (_childChildExpirationTime > newChildExpirationTime) {
        newChildExpirationTime = _childChildExpirationTime;
      }
      _child = _child.sibling;
    }
  }

  completedWork.childExpirationTime = newChildExpirationTime;
}

function commitRoot(root) {
  var renderPriorityLevel = getCurrentPriorityLevel();
  runWithPriority$2(ImmediatePriority, commitRootImpl.bind(null, root, renderPriorityLevel));
  // If there are passive effects, schedule a callback to flush them. This goes
  // outside commitRootImpl so that it inherits the priority of the render.
  if (rootWithPendingPassiveEffects !== null) {
    scheduleCallback(NormalPriority, function () {
      flushPassiveEffects();
      return null;
    });
  }
  return null;
}

function commitRootImpl(root, renderPriorityLevel) {
  flushPassiveEffects();
  flushRenderPhaseStrictModeWarningsInDEV();

  (function () {
    if (!((executionContext & (RenderContext | CommitContext)) === NoContext)) {
      {
        throw ReactError(Error('Should not already be working.'));
      }
    }
  })();

  var finishedWork = root.finishedWork;
  var expirationTime = root.finishedExpirationTime;
  if (finishedWork === null) {
    return null;
  }
  root.finishedWork = null;
  root.finishedExpirationTime = NoWork;

  (function () {
    if (!(finishedWork !== root.current)) {
      {
        throw ReactError(Error('Cannot commit the same tree as before. This error is likely caused by a bug in React. Please file an issue.'));
      }
    }
  })();

  // commitRoot never returns a continuation; it always finishes synchronously.
  // So we can clear these now to allow a new callback to be scheduled.
  root.callbackNode = null;
  root.callbackExpirationTime = NoWork;

  startCommitTimer();

  // Update the first and last pending times on this root. The new first
  // pending time is whatever is left on the root fiber.
  var updateExpirationTimeBeforeCommit = finishedWork.expirationTime;
  var childExpirationTimeBeforeCommit = finishedWork.childExpirationTime;
  var firstPendingTimeBeforeCommit = childExpirationTimeBeforeCommit > updateExpirationTimeBeforeCommit ? childExpirationTimeBeforeCommit : updateExpirationTimeBeforeCommit;
  root.firstPendingTime = firstPendingTimeBeforeCommit;
  if (firstPendingTimeBeforeCommit < root.lastPendingTime) {
    // This usually means we've finished all the work, but it can also happen
    // when something gets downprioritized during render, like a hidden tree.
    root.lastPendingTime = firstPendingTimeBeforeCommit;
  }

  if (root === workInProgressRoot) {
    // We can reset these now that they are finished.
    workInProgressRoot = null;
    workInProgress = null;
    renderExpirationTime = NoWork;
  } else {}
  // This indicates that the last root we worked on is not the same one that
  // we're committing now. This most commonly happens when a suspended root
  // times out.


  // Get the list of effects.
  var firstEffect = void 0;
  if (finishedWork.effectTag > PerformedWork) {
    // A fiber's effect list consists only of its children, not itself. So if
    // the root has an effect, we need to add it to the end of the list. The
    // resulting list is the set that would belong to the root's parent, if it
    // had one; that is, all the effects in the tree including the root.
    if (finishedWork.lastEffect !== null) {
      finishedWork.lastEffect.nextEffect = finishedWork;
      firstEffect = finishedWork.firstEffect;
    } else {
      firstEffect = finishedWork;
    }
  } else {
    // There is no effect on the root.
    firstEffect = finishedWork.firstEffect;
  }

  if (firstEffect !== null) {
    var prevExecutionContext = executionContext;
    executionContext |= CommitContext;
    var prevInteractions = null;
    if (enableSchedulerTracing) {
      prevInteractions = __interactionsRef.current;
      __interactionsRef.current = root.memoizedInteractions;
    }

    // Reset this to null before calling lifecycles
    ReactCurrentOwner$2.current = null;

    // The commit phase is broken into several sub-phases. We do a separate pass
    // of the effect list for each phase: all mutation effects come before all
    // layout effects, and so on.

    // The first phase a "before mutation" phase. We use this phase to read the
    // state of the host tree right before we mutate it. This is where
    // getSnapshotBeforeUpdate is called.
    startCommitSnapshotEffectsTimer();
    prepareForCommit(root.containerInfo);
    nextEffect = firstEffect;
    do {
      {
        invokeGuardedCallback(null, commitBeforeMutationEffects, null);
        if (hasCaughtError()) {
          (function () {
            if (!(nextEffect !== null)) {
              {
                throw ReactError(Error('Should be working on an effect.'));
              }
            }
          })();
          var error = clearCaughtError();
          captureCommitPhaseError(nextEffect, error);
          nextEffect = nextEffect.nextEffect;
        }
      }
    } while (nextEffect !== null);
    stopCommitSnapshotEffectsTimer();

    if (enableProfilerTimer) {
      // Mark the current commit time to be shared by all Profilers in this
      // batch. This enables them to be grouped later.
      recordCommitTime();
    }

    // The next phase is the mutation phase, where we mutate the host tree.
    startCommitHostEffectsTimer();
    nextEffect = firstEffect;
    do {
      {
        invokeGuardedCallback(null, commitMutationEffects, null, renderPriorityLevel);
        if (hasCaughtError()) {
          (function () {
            if (!(nextEffect !== null)) {
              {
                throw ReactError(Error('Should be working on an effect.'));
              }
            }
          })();
          var _error = clearCaughtError();
          captureCommitPhaseError(nextEffect, _error);
          nextEffect = nextEffect.nextEffect;
        }
      }
    } while (nextEffect !== null);
    stopCommitHostEffectsTimer();
    resetAfterCommit(root.containerInfo);

    // The work-in-progress tree is now the current tree. This must come after
    // the mutation phase, so that the previous tree is still current during
    // componentWillUnmount, but before the layout phase, so that the finished
    // work is current during componentDidMount/Update.
    root.current = finishedWork;

    // The next phase is the layout phase, where we call effects that read
    // the host tree after it's been mutated. The idiomatic use case for this is
    // layout, but class component lifecycles also fire here for legacy reasons.
    startCommitLifeCyclesTimer();
    nextEffect = firstEffect;
    do {
      {
        invokeGuardedCallback(null, commitLayoutEffects, null, root, expirationTime);
        if (hasCaughtError()) {
          (function () {
            if (!(nextEffect !== null)) {
              {
                throw ReactError(Error('Should be working on an effect.'));
              }
            }
          })();
          var _error2 = clearCaughtError();
          captureCommitPhaseError(nextEffect, _error2);
          nextEffect = nextEffect.nextEffect;
        }
      }
    } while (nextEffect !== null);
    stopCommitLifeCyclesTimer();

    nextEffect = null;

    // Tell Scheduler to yield at the end of the frame, so the browser has an
    // opportunity to paint.
    requestPaint();

    if (enableSchedulerTracing) {
      __interactionsRef.current = prevInteractions;
    }
    executionContext = prevExecutionContext;
  } else {
    // No effects.
    root.current = finishedWork;
    // Measure these anyway so the flamegraph explicitly shows that there were
    // no effects.
    // TODO: Maybe there's a better way to report this.
    startCommitSnapshotEffectsTimer();
    stopCommitSnapshotEffectsTimer();
    if (enableProfilerTimer) {
      recordCommitTime();
    }
    startCommitHostEffectsTimer();
    stopCommitHostEffectsTimer();
    startCommitLifeCyclesTimer();
    stopCommitLifeCyclesTimer();
  }

  stopCommitTimer();

  var rootDidHavePassiveEffects = rootDoesHavePassiveEffects;

  if (rootDoesHavePassiveEffects) {
    // This commit has passive effects. Stash a reference to them. But don't
    // schedule a callback until after flushing layout work.
    rootDoesHavePassiveEffects = false;
    rootWithPendingPassiveEffects = root;
    pendingPassiveEffectsExpirationTime = expirationTime;
    pendingPassiveEffectsRenderPriority = renderPriorityLevel;
  } else {
    // We are done with the effect chain at this point so let's clear the
    // nextEffect pointers to assist with GC. If we have passive effects, we'll
    // clear this in flushPassiveEffects.
    nextEffect = firstEffect;
    while (nextEffect !== null) {
      var nextNextEffect = nextEffect.nextEffect;
      nextEffect.nextEffect = null;
      nextEffect = nextNextEffect;
    }
  }

  // Check if there's remaining work on this root
  var remainingExpirationTime = root.firstPendingTime;
  if (remainingExpirationTime !== NoWork) {
    var currentTime = requestCurrentTime();
    var priorityLevel = inferPriorityFromExpirationTime(currentTime, remainingExpirationTime);

    if (enableSchedulerTracing) {
      if (spawnedWorkDuringRender !== null) {
        var expirationTimes = spawnedWorkDuringRender;
        spawnedWorkDuringRender = null;
        for (var i = 0; i < expirationTimes.length; i++) {
          scheduleInteractions(root, expirationTimes[i], root.memoizedInteractions);
        }
      }
    }

    scheduleCallbackForRoot(root, priorityLevel, remainingExpirationTime);
  } else {
    // If there's no remaining work, we can clear the set of already failed
    // error boundaries.
    legacyErrorBoundariesThatAlreadyFailed = null;
  }

  if (enableSchedulerTracing) {
    if (!rootDidHavePassiveEffects) {
      // If there are no passive effects, then we can complete the pending interactions.
      // Otherwise, we'll wait until after the passive effects are flushed.
      // Wait to do this until after remaining work has been scheduled,
      // so that we don't prematurely signal complete for interactions when there's e.g. hidden work.
      finishPendingInteractions(root, expirationTime);
    }
  }

  onCommitRoot(finishedWork.stateNode, expirationTime);

  if (remainingExpirationTime === Sync) {
    // Count the number of times the root synchronously re-renders without
    // finishing. If there are too many, it indicates an infinite update loop.
    if (root === rootWithNestedUpdates) {
      nestedUpdateCount++;
    } else {
      nestedUpdateCount = 0;
      rootWithNestedUpdates = root;
    }
  } else {
    nestedUpdateCount = 0;
  }

  if (hasUncaughtError) {
    hasUncaughtError = false;
    var _error3 = firstUncaughtError;
    firstUncaughtError = null;
    throw _error3;
  }

  if ((executionContext & LegacyUnbatchedContext) !== NoContext) {
    // This is a legacy edge case. We just committed the initial mount of
    // a ReactDOM.render-ed root inside of batchedUpdates. The commit fired
    // synchronously, but layout updates should be deferred until the end
    // of the batch.
    return null;
  }

  // If layout work was scheduled, flush it now.
  flushSyncCallbackQueue();
  return null;
}

function commitBeforeMutationEffects() {
  while (nextEffect !== null) {
    if ((nextEffect.effectTag & Snapshot) !== NoEffect) {
      setCurrentFiber(nextEffect);
      recordEffect();

      var current$$1 = nextEffect.alternate;
      commitBeforeMutationLifeCycles(current$$1, nextEffect);

      resetCurrentFiber();
    }
    nextEffect = nextEffect.nextEffect;
  }
}

function commitMutationEffects(renderPriorityLevel) {
  // TODO: Should probably move the bulk of this function to commitWork.
  while (nextEffect !== null) {
    setCurrentFiber(nextEffect);

    var effectTag = nextEffect.effectTag;

    if (effectTag & ContentReset) {
      commitResetTextContent(nextEffect);
    }

    if (effectTag & Ref) {
      var current$$1 = nextEffect.alternate;
      if (current$$1 !== null) {
        commitDetachRef(current$$1);
      }
    }

    // The following switch statement is only concerned about placement,
    // updates, and deletions. To avoid needing to add a case for every possible
    // bitmap value, we remove the secondary effects from the effect tag and
    // switch on that value.
    var primaryEffectTag = effectTag & (Placement | Update | Deletion);
    switch (primaryEffectTag) {
      case Placement:
        {
          commitPlacement(nextEffect);
          // Clear the "placement" from effect tag so that we know that this is
          // inserted, before any life-cycles like componentDidMount gets called.
          // TODO: findDOMNode doesn't rely on this any more but isMounted does
          // and isMounted is deprecated anyway so we should be able to kill this.
          nextEffect.effectTag &= ~Placement;
          break;
        }
      case PlacementAndUpdate:
        {
          // Placement
          commitPlacement(nextEffect);
          // Clear the "placement" from effect tag so that we know that this is
          // inserted, before any life-cycles like componentDidMount gets called.
          nextEffect.effectTag &= ~Placement;

          // Update
          var _current = nextEffect.alternate;
          commitWork(_current, nextEffect);
          break;
        }
      case Update:
        {
          var _current2 = nextEffect.alternate;
          commitWork(_current2, nextEffect);
          break;
        }
      case Deletion:
        {
          commitDeletion(nextEffect, renderPriorityLevel);
          break;
        }
    }

    // TODO: Only record a mutation effect if primaryEffectTag is non-zero.
    recordEffect();

    resetCurrentFiber();
    nextEffect = nextEffect.nextEffect;
  }
}

function commitLayoutEffects(root, committedExpirationTime) {
  // TODO: Should probably move the bulk of this function to commitWork.
  while (nextEffect !== null) {
    setCurrentFiber(nextEffect);

    var effectTag = nextEffect.effectTag;

    if (effectTag & (Update | Callback)) {
      recordEffect();
      var current$$1 = nextEffect.alternate;
      commitLifeCycles(root, current$$1, nextEffect, committedExpirationTime);
    }

    if (effectTag & Ref) {
      recordEffect();
      commitAttachRef(nextEffect);
    }

    if (effectTag & Passive) {
      rootDoesHavePassiveEffects = true;
    }

    resetCurrentFiber();
    nextEffect = nextEffect.nextEffect;
  }
}

function flushPassiveEffects() {
  if (rootWithPendingPassiveEffects === null) {
    return false;
  }
  var root = rootWithPendingPassiveEffects;
  var expirationTime = pendingPassiveEffectsExpirationTime;
  var renderPriorityLevel = pendingPassiveEffectsRenderPriority;
  rootWithPendingPassiveEffects = null;
  pendingPassiveEffectsExpirationTime = NoWork;
  pendingPassiveEffectsRenderPriority = NoPriority;
  var priorityLevel = renderPriorityLevel > NormalPriority ? NormalPriority : renderPriorityLevel;
  return runWithPriority$2(priorityLevel, flushPassiveEffectsImpl.bind(null, root, expirationTime));
}

function flushPassiveEffectsImpl(root, expirationTime) {
  var prevInteractions = null;
  if (enableSchedulerTracing) {
    prevInteractions = __interactionsRef.current;
    __interactionsRef.current = root.memoizedInteractions;
  }

  (function () {
    if (!((executionContext & (RenderContext | CommitContext)) === NoContext)) {
      {
        throw ReactError(Error('Cannot flush passive effects while already rendering.'));
      }
    }
  })();
  var prevExecutionContext = executionContext;
  executionContext |= CommitContext;

  // Note: This currently assumes there are no passive effects on the root
  // fiber, because the root is not part of its own effect list. This could
  // change in the future.
  var effect = root.current.firstEffect;
  while (effect !== null) {
    {
      setCurrentFiber(effect);
      invokeGuardedCallback(null, commitPassiveHookEffects, null, effect);
      if (hasCaughtError()) {
        (function () {
          if (!(effect !== null)) {
            {
              throw ReactError(Error('Should be working on an effect.'));
            }
          }
        })();
        var error = clearCaughtError();
        captureCommitPhaseError(effect, error);
      }
      resetCurrentFiber();
    }
    var nextNextEffect = effect.nextEffect;
    // Remove nextEffect pointer to assist GC
    effect.nextEffect = null;
    effect = nextNextEffect;
  }

  if (enableSchedulerTracing) {
    __interactionsRef.current = prevInteractions;
    finishPendingInteractions(root, expirationTime);
  }

  executionContext = prevExecutionContext;
  flushSyncCallbackQueue();

  // If additional passive effects were scheduled, increment a counter. If this
  // exceeds the limit, we'll fire a warning.
  nestedPassiveUpdateCount = rootWithPendingPassiveEffects === null ? 0 : nestedPassiveUpdateCount + 1;

  return true;
}

function isAlreadyFailedLegacyErrorBoundary(instance) {
  return legacyErrorBoundariesThatAlreadyFailed !== null && legacyErrorBoundariesThatAlreadyFailed.has(instance);
}

function markLegacyErrorBoundaryAsFailed(instance) {
  if (legacyErrorBoundariesThatAlreadyFailed === null) {
    legacyErrorBoundariesThatAlreadyFailed = new Set([instance]);
  } else {
    legacyErrorBoundariesThatAlreadyFailed.add(instance);
  }
}

function prepareToThrowUncaughtError(error) {
  if (!hasUncaughtError) {
    hasUncaughtError = true;
    firstUncaughtError = error;
  }
}
var onUncaughtError = prepareToThrowUncaughtError;

function captureCommitPhaseErrorOnRoot(rootFiber, sourceFiber, error) {
  var errorInfo = createCapturedValue(error, sourceFiber);
  var update = createRootErrorUpdate(rootFiber, errorInfo, Sync);
  enqueueUpdate(rootFiber, update);
  var root = markUpdateTimeFromFiberToRoot(rootFiber, Sync);
  if (root !== null) {
    scheduleCallbackForRoot(root, ImmediatePriority, Sync);
  }
}

function captureCommitPhaseError(sourceFiber, error) {
  if (sourceFiber.tag === HostRoot) {
    // Error was thrown at the root. There is no parent, so the root
    // itself should capture it.
    captureCommitPhaseErrorOnRoot(sourceFiber, sourceFiber, error);
    return;
  }

  var fiber = sourceFiber.return;
  while (fiber !== null) {
    if (fiber.tag === HostRoot) {
      captureCommitPhaseErrorOnRoot(fiber, sourceFiber, error);
      return;
    } else if (fiber.tag === ClassComponent) {
      var ctor = fiber.type;
      var instance = fiber.stateNode;
      if (typeof ctor.getDerivedStateFromError === 'function' || typeof instance.componentDidCatch === 'function' && !isAlreadyFailedLegacyErrorBoundary(instance)) {
        var errorInfo = createCapturedValue(error, sourceFiber);
        var update = createClassErrorUpdate(fiber, errorInfo,
        // TODO: This is always sync
        Sync);
        enqueueUpdate(fiber, update);
        var root = markUpdateTimeFromFiberToRoot(fiber, Sync);
        if (root !== null) {
          scheduleCallbackForRoot(root, ImmediatePriority, Sync);
        }
        return;
      }
    }
    fiber = fiber.return;
  }
}

function pingSuspendedRoot(root, thenable, suspendedTime) {
  var pingCache = root.pingCache;
  if (pingCache !== null) {
    // The thenable resolved, so we no longer need to memoize, because it will
    // never be thrown again.
    pingCache.delete(thenable);
  }

  if (workInProgressRoot === root && renderExpirationTime === suspendedTime) {
    // Received a ping at the same priority level at which we're currently
    // rendering. We might want to restart this render. This should mirror
    // the logic of whether or not a root suspends once it completes.

    // TODO: If we're rendering sync either due to Sync, Batched or expired,
    // we should probably never restart.

    // If we're suspended with delay, we'll always suspend so we can always
    // restart. If we're suspended without any updates, it might be a retry.
    // If it's early in the retry we can restart. We can't know for sure
    // whether we'll eventually process an update during this render pass,
    // but it's somewhat unlikely that we get to a ping before that, since
    // getting to the root most update is usually very fast.
    if (workInProgressRootExitStatus === RootSuspendedWithDelay || workInProgressRootExitStatus === RootSuspended && workInProgressRootLatestProcessedExpirationTime === Sync && now() - globalMostRecentFallbackTime < FALLBACK_THROTTLE_MS) {
      // Restart from the root. Don't need to schedule a ping because
      // we're already working on this tree.
      prepareFreshStack(root, renderExpirationTime);
    } else {
      // Even though we can't restart right now, we might get an
      // opportunity later. So we mark this render as having a ping.
      workInProgressRootHasPendingPing = true;
    }
    return;
  }

  var lastPendingTime = root.lastPendingTime;
  if (lastPendingTime < suspendedTime) {
    // The root is no longer suspended at this time.
    return;
  }

  var pingTime = root.pingTime;
  if (pingTime !== NoWork && pingTime < suspendedTime) {
    // There's already a lower priority ping scheduled.
    return;
  }

  // Mark the time at which this ping was scheduled.
  root.pingTime = suspendedTime;

  if (root.finishedExpirationTime === suspendedTime) {
    // If there's a pending fallback waiting to commit, throw it away.
    root.finishedExpirationTime = NoWork;
    root.finishedWork = null;
  }

  var currentTime = requestCurrentTime();
  var priorityLevel = inferPriorityFromExpirationTime(currentTime, suspendedTime);
  scheduleCallbackForRoot(root, priorityLevel, suspendedTime);
}

function retryTimedOutBoundary(boundaryFiber) {
  // The boundary fiber (a Suspense component or SuspenseList component)
  // previously was rendered in its fallback state. One of the promises that
  // suspended it has resolved, which means at least part of the tree was
  // likely unblocked. Try rendering again, at a new expiration time.
  var currentTime = requestCurrentTime();
  var suspenseConfig = null; // Retries don't carry over the already committed update.
  var retryTime = computeExpirationForFiber(currentTime, boundaryFiber, suspenseConfig);
  // TODO: Special case idle priority?
  var priorityLevel = inferPriorityFromExpirationTime(currentTime, retryTime);
  var root = markUpdateTimeFromFiberToRoot(boundaryFiber, retryTime);
  if (root !== null) {
    scheduleCallbackForRoot(root, priorityLevel, retryTime);
  }
}

function resolveRetryThenable(boundaryFiber, thenable) {
  var retryCache = void 0;
  if (enableSuspenseServerRenderer) {
    switch (boundaryFiber.tag) {
      case SuspenseComponent:
        retryCache = boundaryFiber.stateNode;
        break;
      case DehydratedSuspenseComponent:
        retryCache = boundaryFiber.memoizedState;
        break;
      default:
        (function () {
          {
            {
              throw ReactError(Error('Pinged unknown suspense boundary type. This is probably a bug in React.'));
            }
          }
        })();
    }
  } else {
    retryCache = boundaryFiber.stateNode;
  }

  if (retryCache !== null) {
    // The thenable resolved, so we no longer need to memoize, because it will
    // never be thrown again.
    retryCache.delete(thenable);
  }

  retryTimedOutBoundary(boundaryFiber);
}

// Computes the next Just Noticeable Difference (JND) boundary.
// The theory is that a person can't tell the difference between small differences in time.
// Therefore, if we wait a bit longer than necessary that won't translate to a noticeable
// difference in the experience. However, waiting for longer might mean that we can avoid
// showing an intermediate loading state. The longer we have already waited, the harder it
// is to tell small differences in time. Therefore, the longer we've already waited,
// the longer we can wait additionally. At some point we have to give up though.
// We pick a train model where the next boundary commits at a consistent schedule.
// These particular numbers are vague estimates. We expect to adjust them based on research.
function jnd(timeElapsed) {
  return timeElapsed < 120 ? 120 : timeElapsed < 480 ? 480 : timeElapsed < 1080 ? 1080 : timeElapsed < 1920 ? 1920 : timeElapsed < 3000 ? 3000 : timeElapsed < 4320 ? 4320 : ceil(timeElapsed / 1960) * 1960;
}

function computeMsUntilSuspenseLoadingDelay(mostRecentEventTime, committedExpirationTime, suspenseConfig) {
  var busyMinDurationMs = suspenseConfig.busyMinDurationMs | 0;
  if (busyMinDurationMs <= 0) {
    return 0;
  }
  var busyDelayMs = suspenseConfig.busyDelayMs | 0;

  // Compute the time until this render pass would expire.
  var currentTimeMs = now();
  var eventTimeMs = inferTimeFromExpirationTimeWithSuspenseConfig(mostRecentEventTime, suspenseConfig);
  var timeElapsed = currentTimeMs - eventTimeMs;
  if (timeElapsed <= busyDelayMs) {
    // If we haven't yet waited longer than the initial delay, we don't
    // have to wait any additional time.
    return 0;
  }
  var msUntilTimeout = busyDelayMs + busyMinDurationMs - timeElapsed;
  // This is the value that is passed to `setTimeout`.
  return msUntilTimeout;
}

function checkForNestedUpdates() {
  if (nestedUpdateCount > NESTED_UPDATE_LIMIT) {
    nestedUpdateCount = 0;
    rootWithNestedUpdates = null;
    (function () {
      {
        {
          throw ReactError(Error('Maximum update depth exceeded. This can happen when a component repeatedly calls setState inside componentWillUpdate or componentDidUpdate. React limits the number of nested updates to prevent infinite loops.'));
        }
      }
    })();
  }

  {
    if (nestedPassiveUpdateCount > NESTED_PASSIVE_UPDATE_LIMIT) {
      nestedPassiveUpdateCount = 0;
      warning$1(false, 'Maximum update depth exceeded. This can happen when a component ' + "calls setState inside useEffect, but useEffect either doesn't " + 'have a dependency array, or one of the dependencies changes on ' + 'every render.');
    }
  }
}

function flushRenderPhaseStrictModeWarningsInDEV() {
  {
    ReactStrictModeWarnings.flushLegacyContextWarning();

    if (warnAboutDeprecatedLifecycles) {
      ReactStrictModeWarnings.flushPendingUnsafeLifecycleWarnings();
    }
  }
}

function stopFinishedWorkLoopTimer() {
  var didCompleteRoot = true;
  stopWorkLoopTimer(interruptedBy, didCompleteRoot);
  interruptedBy = null;
}

function stopInterruptedWorkLoopTimer() {
  // TODO: Track which fiber caused the interruption.
  var didCompleteRoot = false;
  stopWorkLoopTimer(interruptedBy, didCompleteRoot);
  interruptedBy = null;
}

function checkForInterruption(fiberThatReceivedUpdate, updateExpirationTime) {
  if (enableUserTimingAPI && workInProgressRoot !== null && updateExpirationTime > renderExpirationTime) {
    interruptedBy = fiberThatReceivedUpdate;
  }
}

var didWarnStateUpdateForUnmountedComponent = null;
function warnAboutUpdateOnUnmountedFiberInDEV(fiber) {
  {
    var tag = fiber.tag;
    if (tag !== HostRoot && tag !== ClassComponent && tag !== FunctionComponent && tag !== ForwardRef && tag !== MemoComponent && tag !== SimpleMemoComponent) {
      // Only warn for user-defined components, not internal ones like Suspense.
      return;
    }
    // We show the whole stack but dedupe on the top component's name because
    // the problematic code almost always lies inside that component.
    var componentName = getComponentName(fiber.type) || 'ReactComponent';
    if (didWarnStateUpdateForUnmountedComponent !== null) {
      if (didWarnStateUpdateForUnmountedComponent.has(componentName)) {
        return;
      }
      didWarnStateUpdateForUnmountedComponent.add(componentName);
    } else {
      didWarnStateUpdateForUnmountedComponent = new Set([componentName]);
    }
    warningWithoutStack$1(false, "Can't perform a React state update on an unmounted component. This " + 'is a no-op, but it indicates a memory leak in your application. To ' + 'fix, cancel all subscriptions and asynchronous tasks in %s.%s', tag === ClassComponent ? 'the componentWillUnmount method' : 'a useEffect cleanup function', getStackByFiberInDevAndProd(fiber));
  }
}

var beginWork$$1 = void 0;
if (true && replayFailedUnitOfWorkWithInvokeGuardedCallback) {
  var dummyFiber = null;
  beginWork$$1 = function (current$$1, unitOfWork, expirationTime) {
    // If a component throws an error, we replay it again in a synchronously
    // dispatched event, so that the debugger will treat it as an uncaught
    // error See ReactErrorUtils for more information.

    // Before entering the begin phase, copy the work-in-progress onto a dummy
    // fiber. If beginWork throws, we'll use this to reset the state.
    var originalWorkInProgressCopy = assignFiberPropertiesInDEV(dummyFiber, unitOfWork);
    try {
      return beginWork$1(current$$1, unitOfWork, expirationTime);
    } catch (originalError) {
      if (originalError !== null && typeof originalError === 'object' && typeof originalError.then === 'function') {
        // Don't replay promises. Treat everything else like an error.
        throw originalError;
      }

      // Keep this code in sync with renderRoot; any changes here must have
      // corresponding changes there.
      resetContextDependencies();
      resetHooks();

      // Unwind the failed stack frame
      unwindInterruptedWork(unitOfWork);

      // Restore the original properties of the fiber.
      assignFiberPropertiesInDEV(unitOfWork, originalWorkInProgressCopy);

      if (enableProfilerTimer && unitOfWork.mode & ProfileMode) {
        // Reset the profiler timer.
        startProfilerTimer(unitOfWork);
      }

      // Run beginWork again.
      invokeGuardedCallback(null, beginWork$1, null, current$$1, unitOfWork, expirationTime);

      if (hasCaughtError()) {
        var replayError = clearCaughtError();
        // `invokeGuardedCallback` sometimes sets an expando `_suppressLogging`.
        // Rethrow this error instead of the original one.
        throw replayError;
      } else {
        // This branch is reachable if the render phase is impure.
        throw originalError;
      }
    }
  };
} else {
  beginWork$$1 = beginWork$1;
}

var didWarnAboutUpdateInRender = false;
var didWarnAboutUpdateInGetChildContext = false;
function warnAboutInvalidUpdatesOnClassComponentsInDEV(fiber) {
  {
    if (fiber.tag === ClassComponent) {
      switch (phase) {
        case 'getChildContext':
          if (didWarnAboutUpdateInGetChildContext) {
            return;
          }
          warningWithoutStack$1(false, 'setState(...): Cannot call setState() inside getChildContext()');
          didWarnAboutUpdateInGetChildContext = true;
          break;
        case 'render':
          if (didWarnAboutUpdateInRender) {
            return;
          }
          warningWithoutStack$1(false, 'Cannot update during an existing state transition (such as ' + 'within `render`). Render methods should be a pure function of ' + 'props and state.');
          didWarnAboutUpdateInRender = true;
          break;
      }
    }
  }
}

// a 'shared' variable that changes when act() opens/closes in tests.
var IsThisRendererActing = { current: false };

function warnIfNotScopedWithMatchingAct(fiber) {
  {
    if (warnsIfNotActing === true && IsSomeRendererActing.current === true && IsThisRendererActing.current !== true) {
      warningWithoutStack$1(false, "It looks like you're using the wrong act() around your test interactions.\n" + 'Be sure to use the matching version of act() corresponding to your renderer:\n\n' + '// for react-dom:\n' + "import {act} from 'react-dom/test-utils';\n" + '//...\n' + 'act(() => ...);\n\n' + '// for react-test-renderer:\n' + "import TestRenderer from 'react-test-renderer';\n" + 'const {act} = TestRenderer;\n' + '//...\n' + 'act(() => ...);' + '%s', getStackByFiberInDevAndProd(fiber));
    }
  }
}

function warnIfNotCurrentlyActingEffectsInDEV(fiber) {
  {
    if (warnsIfNotActing === true && (fiber.mode & StrictMode) !== NoMode && IsSomeRendererActing.current === false && IsThisRendererActing.current === false) {
      warningWithoutStack$1(false, 'An update to %s ran an effect, but was not wrapped in act(...).\n\n' + 'When testing, code that causes React state updates should be ' + 'wrapped into act(...):\n\n' + 'act(() => {\n' + '  /* fire events that update state */\n' + '});\n' + '/* assert on the output */\n\n' + "This ensures that you're testing the behavior the user would see " + 'in the browser.' + ' Learn more at https://fb.me/react-wrap-tests-with-act' + '%s', getComponentName(fiber.type), getStackByFiberInDevAndProd(fiber));
    }
  }
}

function warnIfNotCurrentlyActingUpdatesInDEV(fiber) {
  {
    if (warnsIfNotActing === true && executionContext === NoContext && IsSomeRendererActing.current === false && IsThisRendererActing.current === false) {
      warningWithoutStack$1(false, 'An update to %s inside a test was not wrapped in act(...).\n\n' + 'When testing, code that causes React state updates should be ' + 'wrapped into act(...):\n\n' + 'act(() => {\n' + '  /* fire events that update state */\n' + '});\n' + '/* assert on the output */\n\n' + "This ensures that you're testing the behavior the user would see " + 'in the browser.' + ' Learn more at https://fb.me/react-wrap-tests-with-act' + '%s', getComponentName(fiber.type), getStackByFiberInDevAndProd(fiber));
    }
  }
}

var warnIfNotCurrentlyActingUpdatesInDev = warnIfNotCurrentlyActingUpdatesInDEV;

// In tests, we want to enforce a mocked scheduler.
var didWarnAboutUnmockedScheduler = false;
// TODO Before we release concurrent mode, revisit this and decide whether a mocked
// scheduler is the actual recommendation. The alternative could be a testing build,
// a new lib, or whatever; we dunno just yet. This message is for early adopters
// to get their tests right.

function warnIfUnmockedScheduler(fiber) {
  {
    if (didWarnAboutUnmockedScheduler === false && unstable_flushAllWithoutAsserting === undefined) {
      if (fiber.mode & BatchedMode || fiber.mode & ConcurrentMode) {
        didWarnAboutUnmockedScheduler = true;
        warningWithoutStack$1(false, 'In Concurrent or Sync modes, the "scheduler" module needs to be mocked ' + 'to guarantee consistent behaviour across tests and browsers. ' + 'For example, with jest: \n' + "jest.mock('scheduler', () => require('scheduler/unstable_mock'));\n\n" + 'For more info, visit https://fb.me/react-mock-scheduler');
      } else if (warnAboutUnmockedScheduler === true) {
        didWarnAboutUnmockedScheduler = true;
        warningWithoutStack$1(false, 'Starting from React v17, the "scheduler" module will need to be mocked ' + 'to guarantee consistent behaviour across tests and browsers. ' + 'For example, with jest: \n' + "jest.mock('scheduler', () => require('scheduler/unstable_mock'));\n\n" + 'For more info, visit https://fb.me/react-mock-scheduler');
      }
    }
  }
}

var componentsThatTriggeredHighPriSuspend = null;
function checkForWrongSuspensePriorityInDEV(sourceFiber) {
  {
    var currentPriorityLevel = getCurrentPriorityLevel();
    if ((sourceFiber.mode & ConcurrentMode) !== NoEffect && (currentPriorityLevel === UserBlockingPriority$2 || currentPriorityLevel === ImmediatePriority)) {
      var workInProgressNode = sourceFiber;
      while (workInProgressNode !== null) {
        // Add the component that triggered the suspense
        var current$$1 = workInProgressNode.alternate;
        if (current$$1 !== null) {
          // TODO: warn component that triggers the high priority
          // suspend is the HostRoot
          switch (workInProgressNode.tag) {
            case ClassComponent:
              // Loop through the component's update queue and see whether the component
              // has triggered any high priority updates
              var updateQueue = current$$1.updateQueue;
              if (updateQueue !== null) {
                var update = updateQueue.firstUpdate;
                while (update !== null) {
                  var priorityLevel = update.priority;
                  if (priorityLevel === UserBlockingPriority$2 || priorityLevel === ImmediatePriority) {
                    if (componentsThatTriggeredHighPriSuspend === null) {
                      componentsThatTriggeredHighPriSuspend = new Set([getComponentName(workInProgressNode.type)]);
                    } else {
                      componentsThatTriggeredHighPriSuspend.add(getComponentName(workInProgressNode.type));
                    }
                    break;
                  }
                  update = update.next;
                }
              }
              break;
            case FunctionComponent:
            case ForwardRef:
            case SimpleMemoComponent:
              if (workInProgressNode.memoizedState !== null && workInProgressNode.memoizedState.baseUpdate !== null) {
                var _update = workInProgressNode.memoizedState.baseUpdate;
                // Loop through the functional component's memoized state to see whether
                // the component has triggered any high pri updates
                while (_update !== null) {
                  var priority = _update.priority;
                  if (priority === UserBlockingPriority$2 || priority === ImmediatePriority) {
                    if (componentsThatTriggeredHighPriSuspend === null) {
                      componentsThatTriggeredHighPriSuspend = new Set([getComponentName(workInProgressNode.type)]);
                    } else {
                      componentsThatTriggeredHighPriSuspend.add(getComponentName(workInProgressNode.type));
                    }
                    break;
                  }
                  if (_update.next === workInProgressNode.memoizedState.baseUpdate) {
                    break;
                  }
                  _update = _update.next;
                }
              }
              break;
            default:
              break;
          }
        }
        workInProgressNode = workInProgressNode.return;
      }
    }
  }
}

function flushSuspensePriorityWarningInDEV() {
  {
    if (componentsThatTriggeredHighPriSuspend !== null) {
      var componentNames = [];
      componentsThatTriggeredHighPriSuspend.forEach(function (name) {
        return componentNames.push(name);
      });
      componentsThatTriggeredHighPriSuspend = null;

      if (componentNames.length > 0) {
        warningWithoutStack$1(false, '%s triggered a user-blocking update that suspended.' + '\n\n' + 'The fix is to split the update into multiple parts: a user-blocking ' + 'update to provide immediate feedback, and another update that ' + 'triggers the bulk of the changes.' + '\n\n' + 'Refer to the documentation for useSuspenseTransition to learn how ' + 'to implement this pattern.',
        // TODO: Add link to React docs with more information, once it exists
        componentNames.sort().join(', '));
      }
    }
  }
}

function computeThreadID(root, expirationTime) {
  // Interaction threads are unique per root and expiration time.
  return expirationTime * 1000 + root.interactionThreadID;
}

function markSpawnedWork(expirationTime) {
  if (!enableSchedulerTracing) {
    return;
  }
  if (spawnedWorkDuringRender === null) {
    spawnedWorkDuringRender = [expirationTime];
  } else {
    spawnedWorkDuringRender.push(expirationTime);
  }
}

function scheduleInteractions(root, expirationTime, interactions) {
  if (!enableSchedulerTracing) {
    return;
  }

  if (interactions.size > 0) {
    var pendingInteractionMap = root.pendingInteractionMap;
    var pendingInteractions = pendingInteractionMap.get(expirationTime);
    if (pendingInteractions != null) {
      interactions.forEach(function (interaction) {
        if (!pendingInteractions.has(interaction)) {
          // Update the pending async work count for previously unscheduled interaction.
          interaction.__count++;
        }

        pendingInteractions.add(interaction);
      });
    } else {
      pendingInteractionMap.set(expirationTime, new Set(interactions));

      // Update the pending async work count for the current interactions.
      interactions.forEach(function (interaction) {
        interaction.__count++;
      });
    }

    var subscriber = __subscriberRef.current;
    if (subscriber !== null) {
      var threadID = computeThreadID(root, expirationTime);
      subscriber.onWorkScheduled(interactions, threadID);
    }
  }
}

function schedulePendingInteractions(root, expirationTime) {
  // This is called when work is scheduled on a root.
  // It associates the current interactions with the newly-scheduled expiration.
  // They will be restored when that expiration is later committed.
  if (!enableSchedulerTracing) {
    return;
  }

  scheduleInteractions(root, expirationTime, __interactionsRef.current);
}

function startWorkOnPendingInteractions(root, expirationTime) {
  // This is called when new work is started on a root.
  if (!enableSchedulerTracing) {
    return;
  }

  // Determine which interactions this batch of work currently includes, So that
  // we can accurately attribute time spent working on it, And so that cascading
  // work triggered during the render phase will be associated with it.
  var interactions = new Set();
  root.pendingInteractionMap.forEach(function (scheduledInteractions, scheduledExpirationTime) {
    if (scheduledExpirationTime >= expirationTime) {
      scheduledInteractions.forEach(function (interaction) {
        return interactions.add(interaction);
      });
    }
  });

  // Store the current set of interactions on the FiberRoot for a few reasons:
  // We can re-use it in hot functions like renderRoot() without having to
  // recalculate it. We will also use it in commitWork() to pass to any Profiler
  // onRender() hooks. This also provides DevTools with a way to access it when
  // the onCommitRoot() hook is called.
  root.memoizedInteractions = interactions;

  if (interactions.size > 0) {
    var subscriber = __subscriberRef.current;
    if (subscriber !== null) {
      var threadID = computeThreadID(root, expirationTime);
      try {
        subscriber.onWorkStarted(interactions, threadID);
      } catch (error) {
        // If the subscriber throws, rethrow it in a separate task
        scheduleCallback(ImmediatePriority, function () {
          throw error;
        });
      }
    }
  }
}

function finishPendingInteractions(root, committedExpirationTime) {
  if (!enableSchedulerTracing) {
    return;
  }

  var earliestRemainingTimeAfterCommit = root.firstPendingTime;

  var subscriber = void 0;

  try {
    subscriber = __subscriberRef.current;
    if (subscriber !== null && root.memoizedInteractions.size > 0) {
      var threadID = computeThreadID(root, committedExpirationTime);
      subscriber.onWorkStopped(root.memoizedInteractions, threadID);
    }
  } catch (error) {
    // If the subscriber throws, rethrow it in a separate task
    scheduleCallback(ImmediatePriority, function () {
      throw error;
    });
  } finally {
    // Clear completed interactions from the pending Map.
    // Unless the render was suspended or cascading work was scheduled,
    // In which case– leave pending interactions until the subsequent render.
    var pendingInteractionMap = root.pendingInteractionMap;
    pendingInteractionMap.forEach(function (scheduledInteractions, scheduledExpirationTime) {
      // Only decrement the pending interaction count if we're done.
      // If there's still work at the current priority,
      // That indicates that we are waiting for suspense data.
      if (scheduledExpirationTime > earliestRemainingTimeAfterCommit) {
        pendingInteractionMap.delete(scheduledExpirationTime);

        scheduledInteractions.forEach(function (interaction) {
          interaction.__count--;

          if (subscriber !== null && interaction.__count === 0) {
            try {
              subscriber.onInteractionScheduledWorkCompleted(interaction);
            } catch (error) {
              // If the subscriber throws, rethrow it in a separate task
              scheduleCallback(ImmediatePriority, function () {
                throw error;
              });
            }
          }
        });
      }
    });
  }
}