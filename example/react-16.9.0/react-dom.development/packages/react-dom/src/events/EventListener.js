function addEventBubbleListener(element, eventType, listener) {
  element.addEventListener(eventType, listener, false);
}

function addEventCaptureListener(element, eventType, listener) {
  element.addEventListener(eventType, listener, true);
}

function addEventCaptureListenerWithPassiveFlag(element, eventType, listener, passive) {
  element.addEventListener(eventType, listener, {
    capture: true,
    passive: passive
  });
}