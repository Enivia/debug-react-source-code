
// TODO: This is now an empty object. Should we switch this to a boolean?
// Alternatively we can make this use an effect tag similar to SuspenseList.


function shouldCaptureSuspense(workInProgress, hasInvisibleParent) {
  // If it was the primary children that just suspended, capture and render the
  var nextState = workInProgress.memoizedState;
  if (nextState !== null) {
    return false;
  }
  var props = workInProgress.memoizedProps;
  // In order to capture, the Suspense component must have a fallback prop.
  if (props.fallback === undefined) {
    return false;
  }
  // Regular boundaries always capture.
  if (props.unstable_avoidThisFallback !== true) {
    return true;
  }
  // If it's a boundary we should avoid, then we prefer to bubble up to the
  // parent boundary if it is currently invisible.
  if (hasInvisibleParent) {
    return false;
  }
  // If the parent is not able to handle it, we must handle it.
  return true;
}

function findFirstSuspended(row) {
  var node = row;
  while (node !== null) {
    if (node.tag === SuspenseComponent) {
      var state = node.memoizedState;
      if (state !== null) {
        return node;
      }
    } else if (node.tag === SuspenseListComponent &&
    // revealOrder undefined can't be trusted because it don't
    // keep track of whether it suspended or not.
    node.memoizedProps.revealOrder !== undefined) {
      var didSuspend = (node.effectTag & DidCapture) !== NoEffect;
      if (didSuspend) {
        return node;
      }
    } else if (node.child !== null) {
      node.child.return = node;
      node = node.child;
      continue;
    }
    if (node === row) {
      return null;
    }
    while (node.sibling === null) {
      if (node.return === null || node.return === row) {
        return null;
      }
      node = node.return;
    }
    node.sibling.return = node.return;
    node = node.sibling;
  }
  return null;
}