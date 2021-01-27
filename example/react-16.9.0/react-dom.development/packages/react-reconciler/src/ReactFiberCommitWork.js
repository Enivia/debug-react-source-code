var didWarnAboutUndefinedSnapshotBeforeUpdate = null;
{
  didWarnAboutUndefinedSnapshotBeforeUpdate = new Set();
}

var PossiblyWeakSet$1 = typeof WeakSet === 'function' ? WeakSet : Set;

function logError(boundary, errorInfo) {
  var source = errorInfo.source;
  var stack = errorInfo.stack;
  if (stack === null && source !== null) {
    stack = getStackByFiberInDevAndProd(source);
  }

  var capturedError = {
    componentName: source !== null ? getComponentName(source.type) : null,
    componentStack: stack !== null ? stack : '',
    error: errorInfo.value,
    errorBoundary: null,
    errorBoundaryName: null,
    errorBoundaryFound: false,
    willRetry: false
  };

  if (boundary !== null && boundary.tag === ClassComponent) {
    capturedError.errorBoundary = boundary.stateNode;
    capturedError.errorBoundaryName = getComponentName(boundary.type);
    capturedError.errorBoundaryFound = true;
    capturedError.willRetry = true;
  }

  try {
    logCapturedError(capturedError);
  } catch (e) {
    // This method must not throw, or React internal state will get messed up.
    // If console.error is overridden, or logCapturedError() shows a dialog that throws,
    // we want to report this error outside of the normal stack as a last resort.
    // https://github.com/facebook/react/issues/13188
    setTimeout(function () {
      throw e;
    });
  }
}

var callComponentWillUnmountWithTimer = function (current$$1, instance) {
  startPhaseTimer(current$$1, 'componentWillUnmount');
  instance.props = current$$1.memoizedProps;
  instance.state = current$$1.memoizedState;
  instance.componentWillUnmount();
  stopPhaseTimer();
};

// Capture errors so they don't interrupt unmounting.
function safelyCallComponentWillUnmount(current$$1, instance) {
  {
    invokeGuardedCallback(null, callComponentWillUnmountWithTimer, null, current$$1, instance);
    if (hasCaughtError()) {
      var unmountError = clearCaughtError();
      captureCommitPhaseError(current$$1, unmountError);
    }
  }
}

function safelyDetachRef(current$$1) {
  var ref = current$$1.ref;
  if (ref !== null) {
    if (typeof ref === 'function') {
      {
        invokeGuardedCallback(null, ref, null, null);
        if (hasCaughtError()) {
          var refError = clearCaughtError();
          captureCommitPhaseError(current$$1, refError);
        }
      }
    } else {
      ref.current = null;
    }
  }
}

function safelyCallDestroy(current$$1, destroy) {
  {
    invokeGuardedCallback(null, destroy, null);
    if (hasCaughtError()) {
      var error = clearCaughtError();
      captureCommitPhaseError(current$$1, error);
    }
  }
}

function commitBeforeMutationLifeCycles(current$$1, finishedWork) {
  switch (finishedWork.tag) {
    case FunctionComponent:
    case ForwardRef:
    case SimpleMemoComponent:
      {
        commitHookEffectList(UnmountSnapshot, NoEffect$1, finishedWork);
        return;
      }
    case ClassComponent:
      {
        if (finishedWork.effectTag & Snapshot) {
          if (current$$1 !== null) {
            var prevProps = current$$1.memoizedProps;
            var prevState = current$$1.memoizedState;
            startPhaseTimer(finishedWork, 'getSnapshotBeforeUpdate');
            var instance = finishedWork.stateNode;
            // We could update instance props and state here,
            // but instead we rely on them being set during last render.
            // TODO: revisit this when we implement resuming.
            {
              if (finishedWork.type === finishedWork.elementType && !didWarnAboutReassigningProps) {
                !(instance.props === finishedWork.memoizedProps) ? warning$1(false, 'Expected %s props to match memoized props before ' + 'getSnapshotBeforeUpdate. ' + 'This might either be because of a bug in React, or because ' + 'a component reassigns its own `this.props`. ' + 'Please file an issue.', getComponentName(finishedWork.type) || 'instance') : void 0;
                !(instance.state === finishedWork.memoizedState) ? warning$1(false, 'Expected %s state to match memoized state before ' + 'getSnapshotBeforeUpdate. ' + 'This might either be because of a bug in React, or because ' + 'a component reassigns its own `this.props`. ' + 'Please file an issue.', getComponentName(finishedWork.type) || 'instance') : void 0;
              }
            }
            var snapshot = instance.getSnapshotBeforeUpdate(finishedWork.elementType === finishedWork.type ? prevProps : resolveDefaultProps(finishedWork.type, prevProps), prevState);
            {
              var didWarnSet = didWarnAboutUndefinedSnapshotBeforeUpdate;
              if (snapshot === undefined && !didWarnSet.has(finishedWork.type)) {
                didWarnSet.add(finishedWork.type);
                warningWithoutStack$1(false, '%s.getSnapshotBeforeUpdate(): A snapshot value (or null) ' + 'must be returned. You have returned undefined.', getComponentName(finishedWork.type));
              }
            }
            instance.__reactInternalSnapshotBeforeUpdate = snapshot;
            stopPhaseTimer();
          }
        }
        return;
      }
    case HostRoot:
    case HostComponent:
    case HostText:
    case HostPortal:
    case IncompleteClassComponent:
      // Nothing to do for these component types
      return;
    default:
      {
        (function () {
          {
            {
              throw ReactError(Error('This unit of work tag should not have side-effects. This error is likely caused by a bug in React. Please file an issue.'));
            }
          }
        })();
      }
  }
}

function commitHookEffectList(unmountTag, mountTag, finishedWork) {
  var updateQueue = finishedWork.updateQueue;
  var lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
  if (lastEffect !== null) {
    var firstEffect = lastEffect.next;
    var effect = firstEffect;
    do {
      if ((effect.tag & unmountTag) !== NoEffect$1) {
        // Unmount
        var destroy = effect.destroy;
        effect.destroy = undefined;
        if (destroy !== undefined) {
          destroy();
        }
      }
      if ((effect.tag & mountTag) !== NoEffect$1) {
        // Mount
        var create = effect.create;
        effect.destroy = create();

        {
          var _destroy = effect.destroy;
          if (_destroy !== undefined && typeof _destroy !== 'function') {
            var addendum = void 0;
            if (_destroy === null) {
              addendum = ' You returned null. If your effect does not require clean ' + 'up, return undefined (or nothing).';
            } else if (typeof _destroy.then === 'function') {
              addendum = '\n\nIt looks like you wrote useEffect(async () => ...) or returned a Promise. ' + 'Instead, write the async function inside your effect ' + 'and call it immediately:\n\n' + 'useEffect(() => {\n' + '  async function fetchData() {\n' + '    // You can await here\n' + '    const response = await MyAPI.getData(someId);\n' + '    // ...\n' + '  }\n' + '  fetchData();\n' + '}, [someId]); // Or [] if effect doesn\'t need props or state\n\n' + 'Learn more about data fetching with Hooks: https://fb.me/react-hooks-data-fetching';
            } else {
              addendum = ' You returned: ' + _destroy;
            }
            warningWithoutStack$1(false, 'An effect function must not return anything besides a function, ' + 'which is used for clean-up.%s%s', addendum, getStackByFiberInDevAndProd(finishedWork));
          }
        }
      }
      effect = effect.next;
    } while (effect !== firstEffect);
  }
}

function commitPassiveHookEffects(finishedWork) {
  if ((finishedWork.effectTag & Passive) !== NoEffect) {
    switch (finishedWork.tag) {
      case FunctionComponent:
      case ForwardRef:
      case SimpleMemoComponent:
        {
          commitHookEffectList(UnmountPassive, NoEffect$1, finishedWork);
          commitHookEffectList(NoEffect$1, MountPassive, finishedWork);
          break;
        }
      default:
        break;
    }
  }
}

function commitLifeCycles(finishedRoot, current$$1, finishedWork, committedExpirationTime) {
  switch (finishedWork.tag) {
    case FunctionComponent:
    case ForwardRef:
    case SimpleMemoComponent:
      {
        commitHookEffectList(UnmountLayout, MountLayout, finishedWork);
        break;
      }
    case ClassComponent:
      {
        var instance = finishedWork.stateNode;
        if (finishedWork.effectTag & Update) {
          if (current$$1 === null) {
            startPhaseTimer(finishedWork, 'componentDidMount');
            // We could update instance props and state here,
            // but instead we rely on them being set during last render.
            // TODO: revisit this when we implement resuming.
            {
              if (finishedWork.type === finishedWork.elementType && !didWarnAboutReassigningProps) {
                !(instance.props === finishedWork.memoizedProps) ? warning$1(false, 'Expected %s props to match memoized props before ' + 'componentDidMount. ' + 'This might either be because of a bug in React, or because ' + 'a component reassigns its own `this.props`. ' + 'Please file an issue.', getComponentName(finishedWork.type) || 'instance') : void 0;
                !(instance.state === finishedWork.memoizedState) ? warning$1(false, 'Expected %s state to match memoized state before ' + 'componentDidMount. ' + 'This might either be because of a bug in React, or because ' + 'a component reassigns its own `this.props`. ' + 'Please file an issue.', getComponentName(finishedWork.type) || 'instance') : void 0;
              }
            }
            instance.componentDidMount();
            stopPhaseTimer();
          } else {
            var prevProps = finishedWork.elementType === finishedWork.type ? current$$1.memoizedProps : resolveDefaultProps(finishedWork.type, current$$1.memoizedProps);
            var prevState = current$$1.memoizedState;
            startPhaseTimer(finishedWork, 'componentDidUpdate');
            // We could update instance props and state here,
            // but instead we rely on them being set during last render.
            // TODO: revisit this when we implement resuming.
            {
              if (finishedWork.type === finishedWork.elementType && !didWarnAboutReassigningProps) {
                !(instance.props === finishedWork.memoizedProps) ? warning$1(false, 'Expected %s props to match memoized props before ' + 'componentDidUpdate. ' + 'This might either be because of a bug in React, or because ' + 'a component reassigns its own `this.props`. ' + 'Please file an issue.', getComponentName(finishedWork.type) || 'instance') : void 0;
                !(instance.state === finishedWork.memoizedState) ? warning$1(false, 'Expected %s state to match memoized state before ' + 'componentDidUpdate. ' + 'This might either be because of a bug in React, or because ' + 'a component reassigns its own `this.props`. ' + 'Please file an issue.', getComponentName(finishedWork.type) || 'instance') : void 0;
              }
            }
            instance.componentDidUpdate(prevProps, prevState, instance.__reactInternalSnapshotBeforeUpdate);
            stopPhaseTimer();
          }
        }
        var updateQueue = finishedWork.updateQueue;
        if (updateQueue !== null) {
          {
            if (finishedWork.type === finishedWork.elementType && !didWarnAboutReassigningProps) {
              !(instance.props === finishedWork.memoizedProps) ? warning$1(false, 'Expected %s props to match memoized props before ' + 'processing the update queue. ' + 'This might either be because of a bug in React, or because ' + 'a component reassigns its own `this.props`. ' + 'Please file an issue.', getComponentName(finishedWork.type) || 'instance') : void 0;
              !(instance.state === finishedWork.memoizedState) ? warning$1(false, 'Expected %s state to match memoized state before ' + 'processing the update queue. ' + 'This might either be because of a bug in React, or because ' + 'a component reassigns its own `this.props`. ' + 'Please file an issue.', getComponentName(finishedWork.type) || 'instance') : void 0;
            }
          }
          // We could update instance props and state here,
          // but instead we rely on them being set during last render.
          // TODO: revisit this when we implement resuming.
          commitUpdateQueue(finishedWork, updateQueue, instance, committedExpirationTime);
        }
        return;
      }
    case HostRoot:
      {
        var _updateQueue = finishedWork.updateQueue;
        if (_updateQueue !== null) {
          var _instance = null;
          if (finishedWork.child !== null) {
            switch (finishedWork.child.tag) {
              case HostComponent:
                _instance = getPublicInstance(finishedWork.child.stateNode);
                break;
              case ClassComponent:
                _instance = finishedWork.child.stateNode;
                break;
            }
          }
          commitUpdateQueue(finishedWork, _updateQueue, _instance, committedExpirationTime);
        }
        return;
      }
    case HostComponent:
      {
        var _instance2 = finishedWork.stateNode;

        // Renderers may schedule work to be done after host components are mounted
        // (eg DOM renderer may schedule auto-focus for inputs and form controls).
        // These effects should only be committed when components are first mounted,
        // aka when there is no current/alternate.
        if (current$$1 === null && finishedWork.effectTag & Update) {
          var type = finishedWork.type;
          var props = finishedWork.memoizedProps;
          commitMount(_instance2, type, props, finishedWork);
        }

        return;
      }
    case HostText:
      {
        // We have no life-cycles associated with text.
        return;
      }
    case HostPortal:
      {
        // We have no life-cycles associated with portals.
        return;
      }
    case Profiler:
      {
        if (enableProfilerTimer) {
          var onRender = finishedWork.memoizedProps.onRender;

          if (typeof onRender === 'function') {
            if (enableSchedulerTracing) {
              onRender(finishedWork.memoizedProps.id, current$$1 === null ? 'mount' : 'update', finishedWork.actualDuration, finishedWork.treeBaseDuration, finishedWork.actualStartTime, getCommitTime(), finishedRoot.memoizedInteractions);
            } else {
              onRender(finishedWork.memoizedProps.id, current$$1 === null ? 'mount' : 'update', finishedWork.actualDuration, finishedWork.treeBaseDuration, finishedWork.actualStartTime, getCommitTime());
            }
          }
        }
        return;
      }
    case SuspenseComponent:
    case SuspenseListComponent:
    case IncompleteClassComponent:
    case FundamentalComponent:
      return;
    default:
      {
        (function () {
          {
            {
              throw ReactError(Error('This unit of work tag should not have side-effects. This error is likely caused by a bug in React. Please file an issue.'));
            }
          }
        })();
      }
  }
}

function hideOrUnhideAllChildren(finishedWork, isHidden) {
  if (supportsMutation) {
    // We only have the top Fiber that was inserted but we need to recurse down its
    var node = finishedWork;
    while (true) {
      if (node.tag === HostComponent) {
        var instance = node.stateNode;
        if (isHidden) {
          hideInstance(instance);
        } else {
          unhideInstance(node.stateNode, node.memoizedProps);
        }
      } else if (node.tag === HostText) {
        var _instance3 = node.stateNode;
        if (isHidden) {
          hideTextInstance(_instance3);
        } else {
          unhideTextInstance(_instance3, node.memoizedProps);
        }
      } else if (node.tag === SuspenseComponent && node.memoizedState !== null) {
        // Found a nested Suspense component that timed out. Skip over the
        var fallbackChildFragment = node.child.sibling;
        fallbackChildFragment.return = node;
        node = fallbackChildFragment;
        continue;
      } else if (node.child !== null) {
        node.child.return = node;
        node = node.child;
        continue;
      }
      if (node === finishedWork) {
        return;
      }
      while (node.sibling === null) {
        if (node.return === null || node.return === finishedWork) {
          return;
        }
        node = node.return;
      }
      node.sibling.return = node.return;
      node = node.sibling;
    }
  }
}

function commitAttachRef(finishedWork) {
  var ref = finishedWork.ref;
  if (ref !== null) {
    var instance = finishedWork.stateNode;
    var instanceToUse = void 0;
    switch (finishedWork.tag) {
      case HostComponent:
        instanceToUse = getPublicInstance(instance);
        break;
      default:
        instanceToUse = instance;
    }
    if (typeof ref === 'function') {
      ref(instanceToUse);
    } else {
      {
        if (!ref.hasOwnProperty('current')) {
          warningWithoutStack$1(false, 'Unexpected ref object provided for %s. ' + 'Use either a ref-setter function or React.createRef().%s', getComponentName(finishedWork.type), getStackByFiberInDevAndProd(finishedWork));
        }
      }

      ref.current = instanceToUse;
    }
  }
}

function commitDetachRef(current$$1) {
  var currentRef = current$$1.ref;
  if (currentRef !== null) {
    if (typeof currentRef === 'function') {
      currentRef(null);
    } else {
      currentRef.current = null;
    }
  }
}

// User-originating errors (lifecycles and refs) should not interrupt
// deletion, so don't let them throw. Host-originating errors should
// interrupt deletion, so it's okay
function commitUnmount(current$$1, renderPriorityLevel) {
  onCommitUnmount(current$$1);

  switch (current$$1.tag) {
    case FunctionComponent:
    case ForwardRef:
    case MemoComponent:
    case SimpleMemoComponent:
      {
        var updateQueue = current$$1.updateQueue;
        if (updateQueue !== null) {
          var lastEffect = updateQueue.lastEffect;
          if (lastEffect !== null) {
            var firstEffect = lastEffect.next;

            // When the owner fiber is deleted, the destroy function of a passive
            // effect hook is called during the synchronous commit phase. This is
            // a concession to implementation complexity. Calling it in the
            // passive effect phase (like they usually are, when dependencies
            // change during an update) would require either traversing the
            // children of the deleted fiber again, or including unmount effects
            // as part of the fiber effect list.
            //
            // Because this is during the sync commit phase, we need to change
            // the priority.
            //
            // TODO: Reconsider this implementation trade off.
            var priorityLevel = renderPriorityLevel > NormalPriority ? NormalPriority : renderPriorityLevel;
            runWithPriority$2(priorityLevel, function () {
              var effect = firstEffect;
              do {
                var destroy = effect.destroy;
                if (destroy !== undefined) {
                  safelyCallDestroy(current$$1, destroy);
                }
                effect = effect.next;
              } while (effect !== firstEffect);
            });
          }
        }
        break;
      }
    case ClassComponent:
      {
        safelyDetachRef(current$$1);
        var instance = current$$1.stateNode;
        if (typeof instance.componentWillUnmount === 'function') {
          safelyCallComponentWillUnmount(current$$1, instance);
        }
        return;
      }
    case HostComponent:
      {
        if (enableFlareAPI) {
          var dependencies = current$$1.dependencies;

          if (dependencies !== null) {
            var respondersMap = dependencies.responders;
            if (respondersMap !== null) {
              var responderInstances = Array.from(respondersMap.values());
              for (var i = 0, length = responderInstances.length; i < length; i++) {
                var responderInstance = responderInstances[i];
                unmountResponderInstance(responderInstance);
              }
              dependencies.responders = null;
            }
          }
        }
        safelyDetachRef(current$$1);
        return;
      }
    case HostPortal:
      {
        // TODO: this is recursive.
        // We are also not using this parent because
        // the portal will get pushed immediately.
        if (supportsMutation) {
          unmountHostComponents(current$$1, renderPriorityLevel);
        } else if (supportsPersistence) {
          emptyPortalContainer(current$$1);
        }
        return;
      }
    case FundamentalComponent:
      {
        if (enableFundamentalAPI) {
          var fundamentalInstance = current$$1.stateNode;
          if (fundamentalInstance !== null) {
            unmountFundamentalComponent(fundamentalInstance);
            current$$1.stateNode = null;
          }
        }
      }
  }
}

function commitNestedUnmounts(root, renderPriorityLevel) {
  // While we're inside a removed host node we don't want to call
  // removeChild on the inner nodes because they're removed by the top
  // call anyway. We also want to call componentWillUnmount on all
  // composites before this host node is removed from the tree. Therefore
  var node = root;
  while (true) {
    commitUnmount(node, renderPriorityLevel);
    // Visit children because they may contain more composite or host nodes.
    // Skip portals because commitUnmount() currently visits them recursively.
    if (node.child !== null && (
    // If we use mutation we drill down into portals using commitUnmount above.
    // If we don't use mutation we drill down into portals here instead.
    !supportsMutation || node.tag !== HostPortal)) {
      node.child.return = node;
      node = node.child;
      continue;
    }
    if (node === root) {
      return;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === root) {
        return;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

function detachFiber(current$$1) {
  // Cut off the return pointers to disconnect it from the tree. Ideally, we
  // should clear the child pointer of the parent alternate to let this
  // get GC:ed but we don't know which for sure which parent is the current
  // one so we'll settle for GC:ing the subtree of this child. This child
  // itself will be GC:ed when the parent updates the next time.
  current$$1.return = null;
  current$$1.child = null;
  current$$1.memoizedState = null;
  current$$1.updateQueue = null;
  current$$1.dependencies = null;
  var alternate = current$$1.alternate;
  if (alternate !== null) {
    alternate.return = null;
    alternate.child = null;
    alternate.memoizedState = null;
    alternate.updateQueue = null;
    alternate.dependencies = null;
  }
}

function emptyPortalContainer(current$$1) {
  if (!supportsPersistence) {
    return;
  }

  var portal = current$$1.stateNode;
  var containerInfo = portal.containerInfo;

  var emptyChildSet = createContainerChildSet(containerInfo);
  replaceContainerChildren(containerInfo, emptyChildSet);
}

function commitContainer(finishedWork) {
  if (!supportsPersistence) {
    return;
  }

  switch (finishedWork.tag) {
    case ClassComponent:
    case HostComponent:
    case HostText:
    case FundamentalComponent:
      {
        return;
      }
    case HostRoot:
    case HostPortal:
      {
        var portalOrRoot = finishedWork.stateNode;
        var containerInfo = portalOrRoot.containerInfo,
            _pendingChildren = portalOrRoot.pendingChildren;

        replaceContainerChildren(containerInfo, _pendingChildren);
        return;
      }
    default:
      {
        (function () {
          {
            {
              throw ReactError(Error('This unit of work tag should not have side-effects. This error is likely caused by a bug in React. Please file an issue.'));
            }
          }
        })();
      }
  }
}

function getHostParentFiber(fiber) {
  var parent = fiber.return;
  while (parent !== null) {
    if (isHostParent(parent)) {
      return parent;
    }
    parent = parent.return;
  }
  (function () {
    {
      {
        throw ReactError(Error('Expected to find a host parent. This error is likely caused by a bug in React. Please file an issue.'));
      }
    }
  })();
}

function isHostParent(fiber) {
  return fiber.tag === HostComponent || fiber.tag === HostRoot || fiber.tag === HostPortal;
}

function getHostSibling(fiber) {
  // We're going to search forward into the tree until we find a sibling host
  // node. Unfortunately, if multiple insertions are done in a row we have to
  // search past them. This leads to exponential search for the next sibling.
  var node = fiber;
  siblings: while (true) {
    // If we didn't find anything, let's try the next sibling.
    while (node.sibling === null) {
      if (node.return === null || isHostParent(node.return)) {
        // If we pop out of the root or hit the parent the fiber we are the
        // last sibling.
        return null;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
    while (node.tag !== HostComponent && node.tag !== HostText && node.tag !== DehydratedSuspenseComponent) {
      // If it is not host node and, we might have a host node inside it.
      // Try to search down until we find one.
      if (node.effectTag & Placement) {
        // If we don't have a child, try the siblings instead.
        continue siblings;
      }
      // If we don't have a child, try the siblings instead.
      // We also skip portals because they are not part of this host tree.
      if (node.child === null || node.tag === HostPortal) {
        continue siblings;
      } else {
        node.child.return = node;
        node = node.child;
      }
    }
    // Check if this host node is stable or about to be placed.
    if (!(node.effectTag & Placement)) {
      // Found it!
      return node.stateNode;
    }
  }
}

function commitPlacement(finishedWork) {
  if (!supportsMutation) {
    return;
  }

  // Recursively insert all host nodes into the parent.
  var parentFiber = getHostParentFiber(finishedWork);

  // Note: these two variables *must* always be updated together.
  var parent = void 0;
  var isContainer = void 0;
  var parentStateNode = parentFiber.stateNode;
  switch (parentFiber.tag) {
    case HostComponent:
      parent = parentStateNode;
      isContainer = false;
      break;
    case HostRoot:
      parent = parentStateNode.containerInfo;
      isContainer = true;
      break;
    case HostPortal:
      parent = parentStateNode.containerInfo;
      isContainer = true;
      break;
    case FundamentalComponent:
      if (enableFundamentalAPI) {
        parent = parentStateNode.instance;
        isContainer = false;
      }
    // eslint-disable-next-line-no-fallthrough
    default:
      (function () {
        {
          {
            throw ReactError(Error('Invalid host parent fiber. This error is likely caused by a bug in React. Please file an issue.'));
          }
        }
      })();
  }
  if (parentFiber.effectTag & ContentReset) {
    // Reset the text content of the parent before doing any insertions
    resetTextContent(parent);
    // Clear ContentReset from the effect tag
    parentFiber.effectTag &= ~ContentReset;
  }

  var before = getHostSibling(finishedWork);
  // We only have the top Fiber that was inserted but we need to recurse down its
  // children to find all the terminal nodes.
  var node = finishedWork;
  while (true) {
    var isHost = node.tag === HostComponent || node.tag === HostText;
    if (isHost || node.tag === FundamentalComponent) {
      var stateNode = isHost ? node.stateNode : node.stateNode.instance;
      if (before) {
        if (isContainer) {
          insertInContainerBefore(parent, stateNode, before);
        } else {
          insertBefore(parent, stateNode, before);
        }
      } else {
        if (isContainer) {
          appendChildToContainer(parent, stateNode);
        } else {
          appendChild(parent, stateNode);
        }
      }
    } else if (node.tag === HostPortal) {
      // If the insertion itself is a portal, then we don't want to traverse
      // down its children. Instead, we'll get insertions from each child in
      // the portal directly.
    } else if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }
    if (node === finishedWork) {
      return;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === finishedWork) {
        return;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

function unmountHostComponents(current$$1, renderPriorityLevel) {
  // We only have the top Fiber that was deleted but we need to recurse down its
  var node = current$$1;

  // Each iteration, currentParent is populated with node's host parent if not
  // currentParentIsValid.
  var currentParentIsValid = false;

  // Note: these two variables *must* always be updated together.
  var currentParent = void 0;
  var currentParentIsContainer = void 0;

  while (true) {
    if (!currentParentIsValid) {
      var parent = node.return;
      findParent: while (true) {
        (function () {
          if (!(parent !== null)) {
            {
              throw ReactError(Error('Expected to find a host parent. This error is likely caused by a bug in React. Please file an issue.'));
            }
          }
        })();
        var parentStateNode = parent.stateNode;
        switch (parent.tag) {
          case HostComponent:
            currentParent = parentStateNode;
            currentParentIsContainer = false;
            break findParent;
          case HostRoot:
            currentParent = parentStateNode.containerInfo;
            currentParentIsContainer = true;
            break findParent;
          case HostPortal:
            currentParent = parentStateNode.containerInfo;
            currentParentIsContainer = true;
            break findParent;
          case FundamentalComponent:
            if (enableFundamentalAPI) {
              currentParent = parentStateNode.instance;
              currentParentIsContainer = false;
            }
        }
        parent = parent.return;
      }
      currentParentIsValid = true;
    }

    if (node.tag === HostComponent || node.tag === HostText) {
      commitNestedUnmounts(node, renderPriorityLevel);
      // After all the children have unmounted, it is now safe to remove the
      // node from the tree.
      if (currentParentIsContainer) {
        removeChildFromContainer(currentParent, node.stateNode);
      } else {
        removeChild(currentParent, node.stateNode);
      }
      // Don't visit children because we already visited them.
    } else if (node.tag === FundamentalComponent) {
      var fundamentalNode = node.stateNode.instance;
      commitNestedUnmounts(node, renderPriorityLevel);
      // After all the children have unmounted, it is now safe to remove the
      // node from the tree.
      if (currentParentIsContainer) {
        removeChildFromContainer(currentParent, fundamentalNode);
      } else {
        removeChild(currentParent, fundamentalNode);
      }
    } else if (enableSuspenseServerRenderer && node.tag === DehydratedSuspenseComponent) {
      // Delete the dehydrated suspense boundary and all of its content.
      if (currentParentIsContainer) {
        clearSuspenseBoundaryFromContainer(currentParent, node.stateNode);
      } else {
        clearSuspenseBoundary(currentParent, node.stateNode);
      }
    } else if (node.tag === HostPortal) {
      if (node.child !== null) {
        // When we go into a portal, it becomes the parent to remove from.
        // We will reassign it back when we pop the portal on the way up.
        currentParent = node.stateNode.containerInfo;
        currentParentIsContainer = true;
        // Visit children because portals might contain host components.
        node.child.return = node;
        node = node.child;
        continue;
      }
    } else {
      commitUnmount(node, renderPriorityLevel);
      // Visit children because we may find more host components below.
      if (node.child !== null) {
        node.child.return = node;
        node = node.child;
        continue;
      }
    }
    if (node === current$$1) {
      return;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === current$$1) {
        return;
      }
      node = node.return;
      if (node.tag === HostPortal) {
        // When we go out of the portal, we need to restore the parent.
        // Since we don't keep a stack of them, we will search for it.
        currentParentIsValid = false;
      }
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
}

function commitDeletion(current$$1, renderPriorityLevel) {
  if (supportsMutation) {
    // Recursively delete all host nodes from the parent.
    // Detach refs and call componentWillUnmount() on the whole subtree.
    unmountHostComponents(current$$1, renderPriorityLevel);
  } else {
    // Detach refs and call componentWillUnmount() on the whole subtree.
    commitNestedUnmounts(current$$1, renderPriorityLevel);
  }
  detachFiber(current$$1);
}

function commitWork(current$$1, finishedWork) {
  if (!supportsMutation) {
    switch (finishedWork.tag) {
      case FunctionComponent:
      case ForwardRef:
      case MemoComponent:
      case SimpleMemoComponent:
        {
          // Note: We currently never use MountMutation, but useLayout uses
          // UnmountMutation.
          commitHookEffectList(UnmountMutation, MountMutation, finishedWork);
          return;
        }
      case Profiler:
        {
          return;
        }
      case SuspenseComponent:
        {
          commitSuspenseComponent(finishedWork);
          attachSuspenseRetryListeners(finishedWork);
          return;
        }
      case SuspenseListComponent:
        {
          attachSuspenseRetryListeners(finishedWork);
          return;
        }
    }

    commitContainer(finishedWork);
    return;
  }

  switch (finishedWork.tag) {
    case FunctionComponent:
    case ForwardRef:
    case MemoComponent:
    case SimpleMemoComponent:
      {
        // Note: We currently never use MountMutation, but useLayout uses
        // UnmountMutation.
        commitHookEffectList(UnmountMutation, MountMutation, finishedWork);
        return;
      }
    case ClassComponent:
      {
        return;
      }
    case HostComponent:
      {
        var instance = finishedWork.stateNode;
        if (instance != null) {
          // Commit the work prepared earlier.
          var newProps = finishedWork.memoizedProps;
          // For hydration we reuse the update path but we treat the oldProps
          // as the newProps. The updatePayload will contain the real change in
          // this case.
          var oldProps = current$$1 !== null ? current$$1.memoizedProps : newProps;
          var type = finishedWork.type;
          // TODO: Type the updateQueue to be specific to host components.
          var updatePayload = finishedWork.updateQueue;
          finishedWork.updateQueue = null;
          if (updatePayload !== null) {
            commitUpdate(instance, updatePayload, type, oldProps, newProps, finishedWork);
          }
        }
        return;
      }
    case HostText:
      {
        (function () {
          if (!(finishedWork.stateNode !== null)) {
            {
              throw ReactError(Error('This should have a text node initialized. This error is likely caused by a bug in React. Please file an issue.'));
            }
          }
        })();
        var textInstance = finishedWork.stateNode;
        var newText = finishedWork.memoizedProps;
        // For hydration we reuse the update path but we treat the oldProps
        // as the newProps. The updatePayload will contain the real change in
        // this case.
        var oldText = current$$1 !== null ? current$$1.memoizedProps : newText;
        commitTextUpdate(textInstance, oldText, newText);
        return;
      }
    case HostRoot:
      {
        return;
      }
    case Profiler:
      {
        return;
      }
    case SuspenseComponent:
      {
        commitSuspenseComponent(finishedWork);
        attachSuspenseRetryListeners(finishedWork);
        return;
      }
    case SuspenseListComponent:
      {
        attachSuspenseRetryListeners(finishedWork);
        return;
      }
    case IncompleteClassComponent:
      {
        return;
      }
    case FundamentalComponent:
      {
        if (enableFundamentalAPI) {
          var fundamentalInstance = finishedWork.stateNode;
          updateFundamentalComponent(fundamentalInstance);
        }
        return;
      }
    default:
      {
        (function () {
          {
            {
              throw ReactError(Error('This unit of work tag should not have side-effects. This error is likely caused by a bug in React. Please file an issue.'));
            }
          }
        })();
      }
  }
}

function commitSuspenseComponent(finishedWork) {
  var newState = finishedWork.memoizedState;

  var newDidTimeout = void 0;
  var primaryChildParent = finishedWork;
  if (newState === null) {
    newDidTimeout = false;
  } else {
    newDidTimeout = true;
    primaryChildParent = finishedWork.child;
    markCommitTimeOfFallback();
  }

  if (supportsMutation && primaryChildParent !== null) {
    hideOrUnhideAllChildren(primaryChildParent, newDidTimeout);
  }

  if (enableSuspenseCallback && newState !== null) {
    var suspenseCallback = finishedWork.memoizedProps.suspenseCallback;
    if (typeof suspenseCallback === 'function') {
      var thenables = finishedWork.updateQueue;
      if (thenables !== null) {
        suspenseCallback(new Set(thenables));
      }
    } else {
      if (suspenseCallback !== undefined) {
        warning$1(false, 'Unexpected type for suspenseCallback.');
      }
    }
  }
}

function attachSuspenseRetryListeners(finishedWork) {
  // If this boundary just timed out, then it will have a set of thenables.
  // For each thenable, attach a listener so that when it resolves, React
  var thenables = finishedWork.updateQueue;
  if (thenables !== null) {
    finishedWork.updateQueue = null;
    var retryCache = finishedWork.stateNode;
    if (retryCache === null) {
      retryCache = finishedWork.stateNode = new PossiblyWeakSet$1();
    }
    thenables.forEach(function (thenable) {
      // Memoize using the boundary fiber to prevent redundant listeners.
      var retry = resolveRetryThenable.bind(null, finishedWork, thenable);
      if (!retryCache.has(thenable)) {
        if (enableSchedulerTracing) {
          retry = unstable_wrap(retry);
        }
        retryCache.add(thenable);
        thenable.then(retry, retry);
      }
    });
  }
}

function commitResetTextContent(current$$1) {
  if (!supportsMutation) {
    return;
  }
  resetTextContent(current$$1.stateNode);
}

