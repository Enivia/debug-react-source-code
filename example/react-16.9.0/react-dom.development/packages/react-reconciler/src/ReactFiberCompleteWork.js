var emptyObject = {};
var isArray$2 = Array.isArray;

function markUpdate(workInProgress) {
  // Tag the fiber with an update effect. This turns a Placement into
  // a PlacementAndUpdate.
  workInProgress.effectTag |= Update;
}

function markRef$1(workInProgress) {
  workInProgress.effectTag |= Ref;
}

var appendAllChildren = void 0;
var updateHostContainer = void 0;
var updateHostComponent$1 = void 0;
var updateHostText$1 = void 0;
if (supportsMutation) {
  // Mutation mode

  appendAllChildren = function (parent, workInProgress, needsVisibilityToggle, isHidden) {
    // We only have the top Fiber that was created but we need recurse down its
    // children to find all the terminal nodes.
    var node = workInProgress.child;
    while (node !== null) {
      if (node.tag === HostComponent || node.tag === HostText) {
        appendInitialChild(parent, node.stateNode);
      } else if (node.tag === FundamentalComponent) {
        appendInitialChild(parent, node.stateNode.instance);
      } else if (node.tag === HostPortal) {
        // If we have a portal child, then we don't want to traverse
        // down its children. Instead, we'll get insertions from each child in
        // the portal directly.
      } else if (node.child !== null) {
        node.child.return = node;
        node = node.child;
        continue;
      }
      if (node === workInProgress) {
        return;
      }
      while (node.sibling === null) {
        if (node.return === null || node.return === workInProgress) {
          return;
        }
        node = node.return;
      }
      node.sibling.return = node.return;
      node = node.sibling;
    }
  };

  updateHostContainer = function (workInProgress) {
    // Noop
  };
  updateHostComponent$1 = function (current, workInProgress, type, newProps, rootContainerInstance) {
    // If we have an alternate, that means this is an update and we need to
    // schedule a side-effect to do the updates.
    var oldProps = current.memoizedProps;
    if (oldProps === newProps) {
      // In mutation mode, this is sufficient for a bailout because
      // we won't touch this node even if children changed.
      return;
    }

    // If we get updated because one of our children updated, we don't
    // have newProps so we'll have to reuse them.
    // TODO: Split the update API as separate for the props vs. children.
    // Even better would be if children weren't special cased at all tho.
    var instance = workInProgress.stateNode;
    var currentHostContext = getHostContext();
    // TODO: Experiencing an error where oldProps is null. Suggests a host
    // component is hitting the resume path. Figure out why. Possibly
    // related to `hidden`.
    var updatePayload = prepareUpdate(instance, type, oldProps, newProps, rootContainerInstance, currentHostContext);
    // TODO: Type this specific to this type of component.
    workInProgress.updateQueue = updatePayload;
    // If the update payload indicates that there is a change or if there
    // is a new ref we mark this as an update. All the work is done in commitWork.
    if (updatePayload) {
      markUpdate(workInProgress);
    }
  };
  updateHostText$1 = function (current, workInProgress, oldText, newText) {
    // If the text differs, mark it as an update. All the work in done in commitWork.
    if (oldText !== newText) {
      markUpdate(workInProgress);
    }
  };
} else if (supportsPersistence) {
  // Persistent host tree mode

  appendAllChildren = function (parent, workInProgress, needsVisibilityToggle, isHidden) {
    // We only have the top Fiber that was created but we need recurse down its
    // children to find all the terminal nodes.
    var node = workInProgress.child;
    while (node !== null) {
      // eslint-disable-next-line no-labels
      branches: if (node.tag === HostComponent) {
        var instance = node.stateNode;
        if (needsVisibilityToggle && isHidden) {
          // This child is inside a timed out tree. Hide it.
          var props = node.memoizedProps;
          var type = node.type;
          instance = cloneHiddenInstance(instance, type, props, node);
        }
        appendInitialChild(parent, instance);
      } else if (node.tag === HostText) {
        var _instance = node.stateNode;
        if (needsVisibilityToggle && isHidden) {
          // This child is inside a timed out tree. Hide it.
          var text = node.memoizedProps;
          _instance = cloneHiddenTextInstance(_instance, text, node);
        }
        appendInitialChild(parent, _instance);
      } else if (enableFundamentalAPI && node.tag === FundamentalComponent) {
        var _instance2 = node.stateNode.instance;
        if (needsVisibilityToggle && isHidden) {
          // This child is inside a timed out tree. Hide it.
          var _props = node.memoizedProps;
          var _type = node.type;
          _instance2 = cloneHiddenInstance(_instance2, _type, _props, node);
        }
        appendInitialChild(parent, _instance2);
      } else if (node.tag === HostPortal) {
        // If we have a portal child, then we don't want to traverse
        // down its children. Instead, we'll get insertions from each child in
        // the portal directly.
      } else if (node.tag === SuspenseComponent) {
        if ((node.effectTag & Update) !== NoEffect) {
          // Need to toggle the visibility of the primary children.
          var newIsHidden = node.memoizedState !== null;
          if (newIsHidden) {
            var primaryChildParent = node.child;
            if (primaryChildParent !== null) {
              if (primaryChildParent.child !== null) {
                primaryChildParent.child.return = primaryChildParent;
                appendAllChildren(parent, primaryChildParent, true, newIsHidden);
              }
              var fallbackChildParent = primaryChildParent.sibling;
              if (fallbackChildParent !== null) {
                fallbackChildParent.return = node;
                node = fallbackChildParent;
                continue;
              }
            }
          }
        }
        if (node.child !== null) {
          // Continue traversing like normal
          node.child.return = node;
          node = node.child;
          continue;
        }
      } else if (node.child !== null) {
        node.child.return = node;
        node = node.child;
        continue;
      }
      // $FlowFixMe This is correct but Flow is confused by the labeled break.
      node = node;
      if (node === workInProgress) {
        return;
      }
      while (node.sibling === null) {
        if (node.return === null || node.return === workInProgress) {
          return;
        }
        node = node.return;
      }
      node.sibling.return = node.return;
      node = node.sibling;
    }
  };

  // An unfortunate fork of appendAllChildren because we have two different parent types.
  var appendAllChildrenToContainer = function (containerChildSet, workInProgress, needsVisibilityToggle, isHidden) {
    // We only have the top Fiber that was created but we need recurse down its
    // children to find all the terminal nodes.
    var node = workInProgress.child;
    while (node !== null) {
      // eslint-disable-next-line no-labels
      branches: if (node.tag === HostComponent) {
        var instance = node.stateNode;
        if (needsVisibilityToggle && isHidden) {
          // This child is inside a timed out tree. Hide it.
          var props = node.memoizedProps;
          var type = node.type;
          instance = cloneHiddenInstance(instance, type, props, node);
        }
        appendChildToContainerChildSet(containerChildSet, instance);
      } else if (node.tag === HostText) {
        var _instance3 = node.stateNode;
        if (needsVisibilityToggle && isHidden) {
          // This child is inside a timed out tree. Hide it.
          var text = node.memoizedProps;
          _instance3 = cloneHiddenTextInstance(_instance3, text, node);
        }
        appendChildToContainerChildSet(containerChildSet, _instance3);
      } else if (enableFundamentalAPI && node.tag === FundamentalComponent) {
        var _instance4 = node.stateNode.instance;
        if (needsVisibilityToggle && isHidden) {
          // This child is inside a timed out tree. Hide it.
          var _props2 = node.memoizedProps;
          var _type2 = node.type;
          _instance4 = cloneHiddenInstance(_instance4, _type2, _props2, node);
        }
        appendChildToContainerChildSet(containerChildSet, _instance4);
      } else if (node.tag === HostPortal) {
        // If we have a portal child, then we don't want to traverse
        // down its children. Instead, we'll get insertions from each child in
        // the portal directly.
      } else if (node.tag === SuspenseComponent) {
        if ((node.effectTag & Update) !== NoEffect) {
          // Need to toggle the visibility of the primary children.
          var newIsHidden = node.memoizedState !== null;
          if (newIsHidden) {
            var primaryChildParent = node.child;
            if (primaryChildParent !== null) {
              if (primaryChildParent.child !== null) {
                primaryChildParent.child.return = primaryChildParent;
                appendAllChildrenToContainer(containerChildSet, primaryChildParent, true, newIsHidden);
              }
              var fallbackChildParent = primaryChildParent.sibling;
              if (fallbackChildParent !== null) {
                fallbackChildParent.return = node;
                node = fallbackChildParent;
                continue;
              }
            }
          }
        }
        if (node.child !== null) {
          // Continue traversing like normal
          node.child.return = node;
          node = node.child;
          continue;
        }
      } else if (node.child !== null) {
        node.child.return = node;
        node = node.child;
        continue;
      }
      // $FlowFixMe This is correct but Flow is confused by the labeled break.
      node = node;
      if (node === workInProgress) {
        return;
      }
      while (node.sibling === null) {
        if (node.return === null || node.return === workInProgress) {
          return;
        }
        node = node.return;
      }
      node.sibling.return = node.return;
      node = node.sibling;
    }
  };
  updateHostContainer = function (workInProgress) {
    var portalOrRoot = workInProgress.stateNode;
    var childrenUnchanged = workInProgress.firstEffect === null;
    if (childrenUnchanged) {
      // No changes, just reuse the existing instance.
    } else {
      var container = portalOrRoot.containerInfo;
      var newChildSet = createContainerChildSet(container);
      // If children might have changed, we have to add them all to the set.
      appendAllChildrenToContainer(newChildSet, workInProgress, false, false);
      portalOrRoot.pendingChildren = newChildSet;
      // Schedule an update on the container to swap out the container.
      markUpdate(workInProgress);
      finalizeContainerChildren(container, newChildSet);
    }
  };
  updateHostComponent$1 = function (current, workInProgress, type, newProps, rootContainerInstance) {
    var currentInstance = current.stateNode;
    var oldProps = current.memoizedProps;
    // If there are no effects associated with this node, then none of our children had any updates.
    // This guarantees that we can reuse all of them.
    var childrenUnchanged = workInProgress.firstEffect === null;
    if (childrenUnchanged && oldProps === newProps) {
      // No changes, just reuse the existing instance.
      // Note that this might release a previous clone.
      workInProgress.stateNode = currentInstance;
      return;
    }
    var recyclableInstance = workInProgress.stateNode;
    var currentHostContext = getHostContext();
    var updatePayload = null;
    if (oldProps !== newProps) {
      updatePayload = prepareUpdate(recyclableInstance, type, oldProps, newProps, rootContainerInstance, currentHostContext);
    }
    if (childrenUnchanged && updatePayload === null) {
      // No changes, just reuse the existing instance.
      // Note that this might release a previous clone.
      workInProgress.stateNode = currentInstance;
      return;
    }
    var newInstance = cloneInstance(currentInstance, updatePayload, type, oldProps, newProps, workInProgress, childrenUnchanged, recyclableInstance);
    if (finalizeInitialChildren(newInstance, type, newProps, rootContainerInstance, currentHostContext)) {
      markUpdate(workInProgress);
    }
    workInProgress.stateNode = newInstance;
    if (childrenUnchanged) {
      // If there are no other effects in this tree, we need to flag this node as having one.
      // Even though we're not going to use it for anything.
      // Otherwise parents won't know that there are new children to propagate upwards.
      markUpdate(workInProgress);
    } else {
      // If children might have changed, we have to add them all to the set.
      appendAllChildren(newInstance, workInProgress, false, false);
    }
  };
  updateHostText$1 = function (current, workInProgress, oldText, newText) {
    if (oldText !== newText) {
      // If the text content differs, we'll create a new text instance for it.
      var rootContainerInstance = getRootHostContainer();
      var currentHostContext = getHostContext();
      workInProgress.stateNode = createTextInstance(newText, rootContainerInstance, currentHostContext, workInProgress);
      // We'll have to mark it as having an effect, even though we won't use the effect for anything.
      // This lets the parents know that at least one of their children has changed.
      markUpdate(workInProgress);
    }
  };
} else {
  // No host operations
  updateHostContainer = function (workInProgress) {
    // Noop
  };
  updateHostComponent$1 = function (current, workInProgress, type, newProps, rootContainerInstance) {
    // Noop
  };
  updateHostText$1 = function (current, workInProgress, oldText, newText) {
    // Noop
  };
}

function cutOffTailIfNeeded(renderState, hasRenderedATailFallback) {
  switch (renderState.tailMode) {
    case 'hidden':
      {
        // Any insertions at the end of the tail list after this point
        // should be invisible. If there are already mounted boundaries
        // anything before them are not considered for collapsing.
        // Therefore we need to go through the whole tail to find if
        // there are any.
        var tailNode = renderState.tail;
        var lastTailNode = null;
        while (tailNode !== null) {
          if (tailNode.alternate !== null) {
            lastTailNode = tailNode;
          }
          tailNode = tailNode.sibling;
        }
        // Next we're simply going to delete all insertions after the
        // last rendered item.
        if (lastTailNode === null) {
          // All remaining items in the tail are insertions.
          renderState.tail = null;
        } else {
          // Detach the insertion after the last node that was already
          // inserted.
          lastTailNode.sibling = null;
        }
        break;
      }
    case 'collapsed':
      {
        // Any insertions at the end of the tail list after this point
        // should be invisible. If there are already mounted boundaries
        // anything before them are not considered for collapsing.
        // Therefore we need to go through the whole tail to find if
        // there are any.
        var _tailNode = renderState.tail;
        var _lastTailNode = null;
        while (_tailNode !== null) {
          if (_tailNode.alternate !== null) {
            _lastTailNode = _tailNode;
          }
          _tailNode = _tailNode.sibling;
        }
        // Next we're simply going to delete all insertions after the
        // last rendered item.
        if (_lastTailNode === null) {
          // All remaining items in the tail are insertions.
          if (!hasRenderedATailFallback && renderState.tail !== null) {
            // We suspended during the head. We want to show at least one
            // row at the tail. So we'll keep on and cut off the rest.
            renderState.tail.sibling = null;
          } else {
            renderState.tail = null;
          }
        } else {
          // Detach the insertion after the last node that was already
          // inserted.
          _lastTailNode.sibling = null;
        }
        break;
      }
  }
}

function completeWork(current, workInProgress, renderExpirationTime) {
  var newProps = workInProgress.pendingProps;

  switch (workInProgress.tag) {
    case IndeterminateComponent:
      break;
    case LazyComponent:
      break;
    case SimpleMemoComponent:
    case FunctionComponent:
      break;
    case ClassComponent:
      {
        var Component = workInProgress.type;
        if (isContextProvider(Component)) {
          popContext(workInProgress);
        }
        break;
      }
    case HostRoot:
      {
        popHostContainer(workInProgress);
        popTopLevelContextObject(workInProgress);
        var fiberRoot = workInProgress.stateNode;
        if (fiberRoot.pendingContext) {
          fiberRoot.context = fiberRoot.pendingContext;
          fiberRoot.pendingContext = null;
        }
        if (current === null || current.child === null) {
          // If we hydrated, pop so that we can delete any remaining children
          // that weren't hydrated.
          popHydrationState(workInProgress);
          // This resets the hacky state to fix isMounted before committing.
          // TODO: Delete this when we delete isMounted and findDOMNode.
          workInProgress.effectTag &= ~Placement;
        }
        updateHostContainer(workInProgress);
        break;
      }
    case HostComponent:
      {
        popHostContext(workInProgress);
        var rootContainerInstance = getRootHostContainer();
        var type = workInProgress.type;
        if (current !== null && workInProgress.stateNode != null) {
          updateHostComponent$1(current, workInProgress, type, newProps, rootContainerInstance);

          if (enableFlareAPI) {
            var prevListeners = current.memoizedProps.listeners;
            var nextListeners = newProps.listeners;
            var instance = workInProgress.stateNode;
            if (prevListeners !== nextListeners) {
              updateEventListeners(nextListeners, instance, rootContainerInstance, workInProgress);
            }
          }

          if (current.ref !== workInProgress.ref) {
            markRef$1(workInProgress);
          }
        } else {
          if (!newProps) {
            (function () {
              if (!(workInProgress.stateNode !== null)) {
                {
                  throw ReactError(Error('We must have new props for new mounts. This error is likely caused by a bug in React. Please file an issue.'));
                }
              }
            })();
            // This can happen when we abort work.
            break;
          }

          var currentHostContext = getHostContext();
          // TODO: Move createInstance to beginWork and keep it on a context
          // "stack" as the parent. Then append children as we go in beginWork
          // or completeWork depending on we want to add then top->down or
          // bottom->up. Top->down is faster in IE11.
          var wasHydrated = popHydrationState(workInProgress);
          if (wasHydrated) {
            // TODO: Move this and createInstance step into the beginPhase
            // to consolidate.
            if (prepareToHydrateHostInstance(workInProgress, rootContainerInstance, currentHostContext)) {
              // If changes to the hydrated node needs to be applied at the
              // commit-phase we mark this as such.
              markUpdate(workInProgress);
            }
          } else {
            var _instance5 = createInstance(type, newProps, rootContainerInstance, currentHostContext, workInProgress);

            appendAllChildren(_instance5, workInProgress, false, false);

            if (enableFlareAPI) {
              var listeners = newProps.listeners;
              if (listeners != null) {
                updateEventListeners(listeners, _instance5, rootContainerInstance, workInProgress);
              }
            }

            // Certain renderers require commit-time effects for initial mount.
            // (eg DOM renderer supports auto-focus for certain elements).
            // Make sure such renderers get scheduled for later work.
            if (finalizeInitialChildren(_instance5, type, newProps, rootContainerInstance, currentHostContext)) {
              markUpdate(workInProgress);
            }
            workInProgress.stateNode = _instance5;
          }

          if (workInProgress.ref !== null) {
            // If there is a ref on a host node we need to schedule a callback
            markRef$1(workInProgress);
          }
        }
        break;
      }
    case HostText:
      {
        var newText = newProps;
        if (current && workInProgress.stateNode != null) {
          var oldText = current.memoizedProps;
          // If we have an alternate, that means this is an update and we need
          // to schedule a side-effect to do the updates.
          updateHostText$1(current, workInProgress, oldText, newText);
        } else {
          if (typeof newText !== 'string') {
            (function () {
              if (!(workInProgress.stateNode !== null)) {
                {
                  throw ReactError(Error('We must have new props for new mounts. This error is likely caused by a bug in React. Please file an issue.'));
                }
              }
            })();
            // This can happen when we abort work.
          }
          var _rootContainerInstance = getRootHostContainer();
          var _currentHostContext = getHostContext();
          var _wasHydrated = popHydrationState(workInProgress);
          if (_wasHydrated) {
            if (prepareToHydrateHostTextInstance(workInProgress)) {
              markUpdate(workInProgress);
            }
          } else {
            workInProgress.stateNode = createTextInstance(newText, _rootContainerInstance, _currentHostContext, workInProgress);
          }
        }
        break;
      }
    case ForwardRef:
      break;
    case SuspenseComponent:
      {
        popSuspenseContext(workInProgress);
        var nextState = workInProgress.memoizedState;
        if ((workInProgress.effectTag & DidCapture) !== NoEffect) {
          // Something suspended. Re-render with the fallback children.
          workInProgress.expirationTime = renderExpirationTime;
          // Do not reset the effect list.
          return workInProgress;
        }

        var nextDidTimeout = nextState !== null;
        var prevDidTimeout = false;
        if (current === null) {
          // In cases where we didn't find a suitable hydration boundary we never
          // downgraded this to a DehydratedSuspenseComponent, but we still need to
          // pop the hydration state since we might be inside the insertion tree.
          popHydrationState(workInProgress);
        } else {
          var prevState = current.memoizedState;
          prevDidTimeout = prevState !== null;
          if (!nextDidTimeout && prevState !== null) {
            // We just switched from the fallback to the normal children.
            // Delete the fallback.
            // TODO: Would it be better to store the fallback fragment on
            var currentFallbackChild = current.child.sibling;
            if (currentFallbackChild !== null) {
              // Deletions go at the beginning of the return fiber's effect list
              var first = workInProgress.firstEffect;
              if (first !== null) {
                workInProgress.firstEffect = currentFallbackChild;
                currentFallbackChild.nextEffect = first;
              } else {
                workInProgress.firstEffect = workInProgress.lastEffect = currentFallbackChild;
                currentFallbackChild.nextEffect = null;
              }
              currentFallbackChild.effectTag = Deletion;
            }
          }
        }

        if (nextDidTimeout && !prevDidTimeout) {
          // If this subtreee is running in batched mode we can suspend,
          // otherwise we won't suspend.
          // TODO: This will still suspend a synchronous tree if anything
          // in the concurrent tree already suspended during this render.
          // This is a known bug.
          if ((workInProgress.mode & BatchedMode) !== NoMode) {
            // TODO: Move this back to throwException because this is too late
            // if this is a large tree which is common for initial loads. We
            // don't know if we should restart a render or not until we get
            // this marker, and this is too late.
            // If this render already had a ping or lower pri updates,
            // and this is the first time we know we're going to suspend we
            // should be able to immediately restart from within throwException.
            var hasInvisibleChildContext = current === null && workInProgress.memoizedProps.unstable_avoidThisFallback !== true;
            if (hasInvisibleChildContext || hasSuspenseContext(suspenseStackCursor.current, InvisibleParentSuspenseContext)) {
              // If this was in an invisible tree or a new render, then showing
              // this boundary is ok.
              renderDidSuspend();
            } else {
              // Otherwise, we're going to have to hide content so we should
              // suspend for longer if possible.
              renderDidSuspendDelayIfPossible();
            }
          }
        }

        if (supportsPersistence) {
          // TODO: Only schedule updates if not prevDidTimeout.
          if (nextDidTimeout) {
            // If this boundary just timed out, schedule an effect to attach a
            // retry listener to the proimse. This flag is also used to hide the
            // primary children.
            workInProgress.effectTag |= Update;
          }
        }
        if (supportsMutation) {
          // TODO: Only schedule updates if these values are non equal, i.e. it changed.
          if (nextDidTimeout || prevDidTimeout) {
            // If this boundary just timed out, schedule an effect to attach a
            // retry listener to the proimse. This flag is also used to hide the
            // primary children. In mutation mode, we also need the flag to
            // *unhide* children that were previously hidden, so check if the
            // is currently timed out, too.
            workInProgress.effectTag |= Update;
          }
        }
        if (enableSuspenseCallback && workInProgress.updateQueue !== null && workInProgress.memoizedProps.suspenseCallback != null) {
          // Always notify the callback
          workInProgress.effectTag |= Update;
        }
        break;
      }
    case Fragment:
      break;
    case Mode:
      break;
    case Profiler:
      break;
    case HostPortal:
      popHostContainer(workInProgress);
      updateHostContainer(workInProgress);
      break;
    case ContextProvider:
      // Pop provider fiber
      popProvider(workInProgress);
      break;
    case ContextConsumer:
      break;
    case MemoComponent:
      break;
    case IncompleteClassComponent:
      {
        // Same as class component case. I put it down here so that the tags are
        // sequential to ensure this switch is compiled to a jump table.
        var _Component = workInProgress.type;
        if (isContextProvider(_Component)) {
          popContext(workInProgress);
        }
        break;
      }
    case DehydratedSuspenseComponent:
      {
        if (enableSuspenseServerRenderer) {
          popSuspenseContext(workInProgress);
          if (current === null) {
            var _wasHydrated2 = popHydrationState(workInProgress);
            (function () {
              if (!_wasHydrated2) {
                {
                  throw ReactError(Error('A dehydrated suspense component was completed without a hydrated node. This is probably a bug in React.'));
                }
              }
            })();
            if (enableSchedulerTracing) {
              markSpawnedWork(Never);
            }
            skipPastDehydratedSuspenseInstance(workInProgress);
          } else if ((workInProgress.effectTag & DidCapture) === NoEffect) {
            // This boundary did not suspend so it's now hydrated.
            // To handle any future suspense cases, we're going to now upgrade it
            // to a Suspense component. We detach it from the existing current fiber.
            current.alternate = null;
            workInProgress.alternate = null;
            workInProgress.tag = SuspenseComponent;
            workInProgress.memoizedState = null;
            workInProgress.stateNode = null;
          }
        }
        break;
      }
    case SuspenseListComponent:
      {
        popSuspenseContext(workInProgress);

        var renderState = workInProgress.memoizedState;

        if (renderState === null) {
          // We're running in the default, "independent" mode. We don't do anything
          // in this mode.
          break;
        }

        var didSuspendAlready = (workInProgress.effectTag & DidCapture) !== NoEffect;

        var renderedTail = renderState.rendering;
        if (renderedTail === null) {
          // We just rendered the head.
          if (!didSuspendAlready) {
            // This is the first pass. We need to figure out if anything is still
            // suspended in the rendered set.

            // If new content unsuspended, but there's still some content that
            // didn't. Then we need to do a second pass that forces everything
            // to keep showing their fallbacks.

            // We might be suspended if something in this render pass suspended, or
            // something in the previous committed pass suspended. Otherwise,
            // there's no chance so we can skip the expensive call to
            // findFirstSuspended.
            var cannotBeSuspended = renderHasNotSuspendedYet() && (current === null || (current.effectTag & DidCapture) === NoEffect);
            if (!cannotBeSuspended) {
              var row = workInProgress.child;
              while (row !== null) {
                var suspended = findFirstSuspended(row);
                if (suspended !== null) {
                  didSuspendAlready = true;
                  workInProgress.effectTag |= DidCapture;
                  cutOffTailIfNeeded(renderState, false);

                  // If this is a newly suspended tree, it might not get committed as
                  // part of the second pass. In that case nothing will subscribe to
                  // its thennables. Instead, we'll transfer its thennables to the
                  // SuspenseList so that it can retry if they resolve.
                  // There might be multiple of these in the list but since we're
                  // going to wait for all of them anyway, it doesn't really matter
                  // which ones gets to ping. In theory we could get clever and keep
                  // track of how many dependencies remain but it gets tricky because
                  // in the meantime, we can add/remove/change items and dependencies.
                  // We might bail out of the loop before finding any but that
                  // doesn't matter since that means that the other boundaries that
                  // we did find already has their listeners attached.
                  var newThennables = suspended.updateQueue;
                  if (newThennables !== null) {
                    workInProgress.updateQueue = newThennables;
                    workInProgress.effectTag |= Update;
                  }

                  // Rerender the whole list, but this time, we'll force fallbacks
                  // to stay in place.
                  // Reset the effect list before doing the second pass since that's now invalid.
                  workInProgress.firstEffect = workInProgress.lastEffect = null;
                  // Reset the child fibers to their original state.
                  resetChildFibers(workInProgress, renderExpirationTime);

                  // Set up the Suspense Context to force suspense and immediately
                  // rerender the children.
                  pushSuspenseContext(workInProgress, setShallowSuspenseContext(suspenseStackCursor.current, ForceSuspenseFallback));
                  return workInProgress.child;
                }
                row = row.sibling;
              }
            }
          } else {
            cutOffTailIfNeeded(renderState, false);
          }
          // Next we're going to render the tail.
        } else {
          // Append the rendered row to the child list.
          if (!didSuspendAlready) {
            var _suspended = findFirstSuspended(renderedTail);
            if (_suspended !== null) {
              workInProgress.effectTag |= DidCapture;
              didSuspendAlready = true;
              cutOffTailIfNeeded(renderState, true);
              // This might have been modified.
              if (renderState.tail === null && renderState.tailMode === 'hidden') {
                // We need to delete the row we just rendered.
                // Ensure we transfer the update queue to the parent.
                var _newThennables = _suspended.updateQueue;
                if (_newThennables !== null) {
                  workInProgress.updateQueue = _newThennables;
                  workInProgress.effectTag |= Update;
                }
                // Reset the effect list to what it w as before we rendered this
                // child. The nested children have already appended themselves.
                var lastEffect = workInProgress.lastEffect = renderState.lastEffect;
                // Remove any effects that were appended after this point.
                if (lastEffect !== null) {
                  lastEffect.nextEffect = null;
                }
                // We're done.
                return null;
              }
            } else if (now() > renderState.tailExpiration && renderExpirationTime > Never) {
              // We have now passed our CPU deadline and we'll just give up further
              // attempts to render the main content and only render fallbacks.
              // The assumption is that this is usually faster.
              workInProgress.effectTag |= DidCapture;
              didSuspendAlready = true;

              cutOffTailIfNeeded(renderState, false);

              // Since nothing actually suspended, there will nothing to ping this
              // to get it started back up to attempt the next item. If we can show
              // them, then they really have the same priority as this render.
              // So we'll pick it back up the very next render pass once we've had
              // an opportunity to yield for paint.

              var nextPriority = renderExpirationTime - 1;
              workInProgress.expirationTime = workInProgress.childExpirationTime = nextPriority;
              if (enableSchedulerTracing) {
                markSpawnedWork(nextPriority);
              }
            }
          }
          if (renderState.isBackwards) {
            // The effect list of the backwards tail will have been added
            // to the end. This breaks the guarantee that life-cycles fire in
            // sibling order but that isn't a strong guarantee promised by React.
            // Especially since these might also just pop in during future commits.
            // Append to the beginning of the list.
            renderedTail.sibling = workInProgress.child;
            workInProgress.child = renderedTail;
          } else {
            var previousSibling = renderState.last;
            if (previousSibling !== null) {
              previousSibling.sibling = renderedTail;
            } else {
              workInProgress.child = renderedTail;
            }
            renderState.last = renderedTail;
          }
        }

        if (renderState.tail !== null) {
          // We still have tail rows to render.
          if (renderState.tailExpiration === 0) {
            // Heuristic for how long we're willing to spend rendering rows
            // until we just give up and show what we have so far.
            var TAIL_EXPIRATION_TIMEOUT_MS = 500;
            renderState.tailExpiration = now() + TAIL_EXPIRATION_TIMEOUT_MS;
          }
          // Pop a row.
          var next = renderState.tail;
          renderState.rendering = next;
          renderState.tail = next.sibling;
          renderState.lastEffect = workInProgress.lastEffect;
          next.sibling = null;

          // Restore the context.
          // TODO: We can probably just avoid popping it instead and only
          // setting it the first time we go from not suspended to suspended.
          var suspenseContext = suspenseStackCursor.current;
          if (didSuspendAlready) {
            suspenseContext = setShallowSuspenseContext(suspenseContext, ForceSuspenseFallback);
          } else {
            suspenseContext = setDefaultShallowSuspenseContext(suspenseContext);
          }
          pushSuspenseContext(workInProgress, suspenseContext);
          // Do a pass over the next row.
          return next;
        }
        break;
      }
    case FundamentalComponent:
      {
        if (enableFundamentalAPI) {
          var fundamentalImpl = workInProgress.type.impl;
          var fundamentalInstance = workInProgress.stateNode;

          if (fundamentalInstance === null) {
            var getInitialState = fundamentalImpl.getInitialState;
            var fundamentalState = void 0;
            if (getInitialState !== undefined) {
              fundamentalState = getInitialState(newProps);
            }
            fundamentalInstance = workInProgress.stateNode = createFundamentalStateInstance(workInProgress, newProps, fundamentalImpl, fundamentalState || {});
            var _instance6 = getFundamentalComponentInstance(fundamentalInstance);
            fundamentalInstance.instance = _instance6;
            if (fundamentalImpl.reconcileChildren === false) {
              return null;
            }
            appendAllChildren(_instance6, workInProgress, false, false);
            mountFundamentalComponent(fundamentalInstance);
          } else {
            // We fire update in commit phase
            var prevProps = fundamentalInstance.props;
            fundamentalInstance.prevProps = prevProps;
            fundamentalInstance.props = newProps;
            fundamentalInstance.currentFiber = workInProgress;
            if (supportsPersistence) {
              var _instance7 = cloneFundamentalInstance(fundamentalInstance);
              fundamentalInstance.instance = _instance7;
              appendAllChildren(_instance7, workInProgress, false, false);
            }
            var shouldUpdate = shouldUpdateFundamentalComponent(fundamentalInstance);
            if (shouldUpdate) {
              markUpdate(workInProgress);
            }
          }
        }
        break;
      }
    default:
      (function () {
        {
          {
            throw ReactError(Error('Unknown unit of work tag. This error is likely caused by a bug in React. Please file an issue.'));
          }
        }
      })();
  }

  return null;
}

function mountEventResponder$1(responder, responderProps, instance, rootContainerInstance, fiber, respondersMap) {
  var responderState = emptyObject;
  var getInitialState = responder.getInitialState;
  if (getInitialState !== null) {
    responderState = getInitialState(responderProps);
  }
  var responderInstance = createResponderInstance(responder, responderProps, responderState, instance, fiber);
  mountResponderInstance(responder, responderInstance, responderProps, responderState, instance, rootContainerInstance);
  respondersMap.set(responder, responderInstance);
}

function updateEventListener(listener, fiber, visistedResponders, respondersMap, instance, rootContainerInstance) {
  var responder = void 0;
  var props = void 0;

  if (listener) {
    responder = listener.responder;
    props = listener.props;
  }
  (function () {
    if (!(responder && responder.$$typeof === REACT_RESPONDER_TYPE)) {
      {
        throw ReactError(Error('An invalid value was used as an event listener. Expect one or many event listeners created via React.unstable_useResponer().'));
      }
    }
  })();
  var listenerProps = props;
  if (visistedResponders.has(responder)) {
    // show warning
    {
      warning$1(false, 'Duplicate event responder "%s" found in event listeners. ' + 'Event listeners passed to elements cannot use the same event responder more than once.', responder.displayName);
    }
    return;
  }
  visistedResponders.add(responder);
  var responderInstance = respondersMap.get(responder);

  if (responderInstance === undefined) {
    // Mount
    mountEventResponder$1(responder, listenerProps, instance, rootContainerInstance, fiber, respondersMap);
  } else {
    // Update
    responderInstance.props = listenerProps;
    responderInstance.fiber = fiber;
  }
}

function updateEventListeners(listeners, instance, rootContainerInstance, fiber) {
  var visistedResponders = new Set();
  var dependencies = fiber.dependencies;
  if (listeners != null) {
    if (dependencies === null) {
      dependencies = fiber.dependencies = {
        expirationTime: NoWork,
        firstContext: null,
        responders: new Map()
      };
    }
    var respondersMap = dependencies.responders;
    if (respondersMap === null) {
      respondersMap = new Map();
    }
    if (isArray$2(listeners)) {
      for (var i = 0, length = listeners.length; i < length; i++) {
        var listener = listeners[i];
        updateEventListener(listener, fiber, visistedResponders, respondersMap, instance, rootContainerInstance);
      }
    } else {
      updateEventListener(listeners, fiber, visistedResponders, respondersMap, instance, rootContainerInstance);
    }
  }
  if (dependencies !== null) {
    var _respondersMap = dependencies.responders;
    if (_respondersMap !== null) {
      // Unmount
      var mountedResponders = Array.from(_respondersMap.keys());
      for (var _i = 0, _length = mountedResponders.length; _i < _length; _i++) {
        var mountedResponder = mountedResponders[_i];
        if (!visistedResponders.has(mountedResponder)) {
          var responderInstance = _respondersMap.get(mountedResponder);
          unmountResponderInstance(responderInstance);
          _respondersMap.delete(mountedResponder);
        }
      }
    }
  }
}

