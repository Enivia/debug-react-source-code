

function createResponderListener(responder, props) {
  var eventResponderListener = {
    responder: responder,
    props: props
  };
  {
    Object.freeze(eventResponderListener);
  }
  return eventResponderListener;
}

function isFiberSuspenseAndTimedOut(fiber) {
  return fiber.tag === SuspenseComponent && fiber.memoizedState !== null;
}

function getSuspenseFallbackChild(fiber) {
  return fiber.child.sibling.child;
}





function createResponderInstance(responder, responderProps, responderState, target, fiber) {
  return {
    fiber: fiber,
    props: responderProps,
    responder: responder,
    rootEventTypes: null,
    state: responderState,
    target: target
  };
}