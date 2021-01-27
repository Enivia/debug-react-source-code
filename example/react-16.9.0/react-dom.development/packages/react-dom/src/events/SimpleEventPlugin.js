

/**
 * Turns
 * ['abort', ...]
 * into
 * eventTypes = {
 *   'abort': {
 *     phasedRegistrationNames: {
 *       bubbled: 'onAbort',
 *       captured: 'onAbortCapture',
 *     },
 *     dependencies: [TOP_ABORT],
 *   },
 *   ...
 * };
 * topLevelEventsToDispatchConfig = new Map([
 *   [TOP_ABORT, { sameConfig }],
 * ]);
 */

var eventTuples = [
// Discrete events
[TOP_BLUR, 'blur', DiscreteEvent], [TOP_CANCEL, 'cancel', DiscreteEvent], [TOP_CLICK, 'click', DiscreteEvent], [TOP_CLOSE, 'close', DiscreteEvent], [TOP_CONTEXT_MENU, 'contextMenu', DiscreteEvent], [TOP_COPY, 'copy', DiscreteEvent], [TOP_CUT, 'cut', DiscreteEvent], [TOP_AUX_CLICK, 'auxClick', DiscreteEvent], [TOP_DOUBLE_CLICK, 'doubleClick', DiscreteEvent], [TOP_DRAG_END, 'dragEnd', DiscreteEvent], [TOP_DRAG_START, 'dragStart', DiscreteEvent], [TOP_DROP, 'drop', DiscreteEvent], [TOP_FOCUS, 'focus', DiscreteEvent], [TOP_INPUT, 'input', DiscreteEvent], [TOP_INVALID, 'invalid', DiscreteEvent], [TOP_KEY_DOWN, 'keyDown', DiscreteEvent], [TOP_KEY_PRESS, 'keyPress', DiscreteEvent], [TOP_KEY_UP, 'keyUp', DiscreteEvent], [TOP_MOUSE_DOWN, 'mouseDown', DiscreteEvent], [TOP_MOUSE_UP, 'mouseUp', DiscreteEvent], [TOP_PASTE, 'paste', DiscreteEvent], [TOP_PAUSE, 'pause', DiscreteEvent], [TOP_PLAY, 'play', DiscreteEvent], [TOP_POINTER_CANCEL, 'pointerCancel', DiscreteEvent], [TOP_POINTER_DOWN, 'pointerDown', DiscreteEvent], [TOP_POINTER_UP, 'pointerUp', DiscreteEvent], [TOP_RATE_CHANGE, 'rateChange', DiscreteEvent], [TOP_RESET, 'reset', DiscreteEvent], [TOP_SEEKED, 'seeked', DiscreteEvent], [TOP_SUBMIT, 'submit', DiscreteEvent], [TOP_TOUCH_CANCEL, 'touchCancel', DiscreteEvent], [TOP_TOUCH_END, 'touchEnd', DiscreteEvent], [TOP_TOUCH_START, 'touchStart', DiscreteEvent], [TOP_VOLUME_CHANGE, 'volumeChange', DiscreteEvent],

// User-blocking events
[TOP_DRAG, 'drag', UserBlockingEvent], [TOP_DRAG_ENTER, 'dragEnter', UserBlockingEvent], [TOP_DRAG_EXIT, 'dragExit', UserBlockingEvent], [TOP_DRAG_LEAVE, 'dragLeave', UserBlockingEvent], [TOP_DRAG_OVER, 'dragOver', UserBlockingEvent], [TOP_MOUSE_MOVE, 'mouseMove', UserBlockingEvent], [TOP_MOUSE_OUT, 'mouseOut', UserBlockingEvent], [TOP_MOUSE_OVER, 'mouseOver', UserBlockingEvent], [TOP_POINTER_MOVE, 'pointerMove', UserBlockingEvent], [TOP_POINTER_OUT, 'pointerOut', UserBlockingEvent], [TOP_POINTER_OVER, 'pointerOver', UserBlockingEvent], [TOP_SCROLL, 'scroll', UserBlockingEvent], [TOP_TOGGLE, 'toggle', UserBlockingEvent], [TOP_TOUCH_MOVE, 'touchMove', UserBlockingEvent], [TOP_WHEEL, 'wheel', UserBlockingEvent],

// Continuous events
[TOP_ABORT, 'abort', ContinuousEvent], [TOP_ANIMATION_END, 'animationEnd', ContinuousEvent], [TOP_ANIMATION_ITERATION, 'animationIteration', ContinuousEvent], [TOP_ANIMATION_START, 'animationStart', ContinuousEvent], [TOP_CAN_PLAY, 'canPlay', ContinuousEvent], [TOP_CAN_PLAY_THROUGH, 'canPlayThrough', ContinuousEvent], [TOP_DURATION_CHANGE, 'durationChange', ContinuousEvent], [TOP_EMPTIED, 'emptied', ContinuousEvent], [TOP_ENCRYPTED, 'encrypted', ContinuousEvent], [TOP_ENDED, 'ended', ContinuousEvent], [TOP_ERROR, 'error', ContinuousEvent], [TOP_GOT_POINTER_CAPTURE, 'gotPointerCapture', ContinuousEvent], [TOP_LOAD, 'load', ContinuousEvent], [TOP_LOADED_DATA, 'loadedData', ContinuousEvent], [TOP_LOADED_METADATA, 'loadedMetadata', ContinuousEvent], [TOP_LOAD_START, 'loadStart', ContinuousEvent], [TOP_LOST_POINTER_CAPTURE, 'lostPointerCapture', ContinuousEvent], [TOP_PLAYING, 'playing', ContinuousEvent], [TOP_PROGRESS, 'progress', ContinuousEvent], [TOP_SEEKING, 'seeking', ContinuousEvent], [TOP_STALLED, 'stalled', ContinuousEvent], [TOP_SUSPEND, 'suspend', ContinuousEvent], [TOP_TIME_UPDATE, 'timeUpdate', ContinuousEvent], [TOP_TRANSITION_END, 'transitionEnd', ContinuousEvent], [TOP_WAITING, 'waiting', ContinuousEvent]];

var eventTypes$4 = {};
var topLevelEventsToDispatchConfig = {};

for (var i = 0; i < eventTuples.length; i++) {
  var eventTuple = eventTuples[i];
  var topEvent = eventTuple[0];
  var event = eventTuple[1];
  var eventPriority = eventTuple[2];

  var capitalizedEvent = event[0].toUpperCase() + event.slice(1);
  var onEvent = 'on' + capitalizedEvent;

  var config = {
    phasedRegistrationNames: {
      bubbled: onEvent,
      captured: onEvent + 'Capture'
    },
    dependencies: [topEvent],
    eventPriority: eventPriority
  };
  eventTypes$4[event] = config;
  topLevelEventsToDispatchConfig[topEvent] = config;
}

// Only used in DEV for exhaustiveness validation.
var knownHTMLTopLevelTypes = [TOP_ABORT, TOP_CANCEL, TOP_CAN_PLAY, TOP_CAN_PLAY_THROUGH, TOP_CLOSE, TOP_DURATION_CHANGE, TOP_EMPTIED, TOP_ENCRYPTED, TOP_ENDED, TOP_ERROR, TOP_INPUT, TOP_INVALID, TOP_LOAD, TOP_LOADED_DATA, TOP_LOADED_METADATA, TOP_LOAD_START, TOP_PAUSE, TOP_PLAY, TOP_PLAYING, TOP_PROGRESS, TOP_RATE_CHANGE, TOP_RESET, TOP_SEEKED, TOP_SEEKING, TOP_STALLED, TOP_SUBMIT, TOP_SUSPEND, TOP_TIME_UPDATE, TOP_TOGGLE, TOP_VOLUME_CHANGE, TOP_WAITING];

var SimpleEventPlugin = {
  eventTypes: eventTypes$4,

  getEventPriority: function (topLevelType) {
    var config = topLevelEventsToDispatchConfig[topLevelType];
    return config !== undefined ? config.eventPriority : ContinuousEvent;
  },


  extractEvents: function (topLevelType, targetInst, nativeEvent, nativeEventTarget) {
    var dispatchConfig = topLevelEventsToDispatchConfig[topLevelType];
    if (!dispatchConfig) {
      return null;
    }
    var EventConstructor = void 0;
    switch (topLevelType) {
      case TOP_KEY_PRESS:
        // Firefox creates a keypress event for function keys too. This removes
        // the unwanted keypress events. Enter is however both printable and
        // non-printable. One would expect Tab to be as well (but it isn't).
        if (getEventCharCode(nativeEvent) === 0) {
          return null;
        }
      /* falls through */
      case TOP_KEY_DOWN:
      case TOP_KEY_UP:
        EventConstructor = SyntheticKeyboardEvent;
        break;
      case TOP_BLUR:
      case TOP_FOCUS:
        EventConstructor = SyntheticFocusEvent;
        break;
      case TOP_CLICK:
        // Firefox creates a click event on right mouse clicks. This removes the
        // unwanted click events.
        if (nativeEvent.button === 2) {
          return null;
        }
      /* falls through */
      case TOP_AUX_CLICK:
      case TOP_DOUBLE_CLICK:
      case TOP_MOUSE_DOWN:
      case TOP_MOUSE_MOVE:
      case TOP_MOUSE_UP:
      // TODO: Disabled elements should not respond to mouse events
      /* falls through */
      case TOP_MOUSE_OUT:
      case TOP_MOUSE_OVER:
      case TOP_CONTEXT_MENU:
        EventConstructor = SyntheticMouseEvent;
        break;
      case TOP_DRAG:
      case TOP_DRAG_END:
      case TOP_DRAG_ENTER:
      case TOP_DRAG_EXIT:
      case TOP_DRAG_LEAVE:
      case TOP_DRAG_OVER:
      case TOP_DRAG_START:
      case TOP_DROP:
        EventConstructor = SyntheticDragEvent;
        break;
      case TOP_TOUCH_CANCEL:
      case TOP_TOUCH_END:
      case TOP_TOUCH_MOVE:
      case TOP_TOUCH_START:
        EventConstructor = SyntheticTouchEvent;
        break;
      case TOP_ANIMATION_END:
      case TOP_ANIMATION_ITERATION:
      case TOP_ANIMATION_START:
        EventConstructor = SyntheticAnimationEvent;
        break;
      case TOP_TRANSITION_END:
        EventConstructor = SyntheticTransitionEvent;
        break;
      case TOP_SCROLL:
        EventConstructor = SyntheticUIEvent;
        break;
      case TOP_WHEEL:
        EventConstructor = SyntheticWheelEvent;
        break;
      case TOP_COPY:
      case TOP_CUT:
      case TOP_PASTE:
        EventConstructor = SyntheticClipboardEvent;
        break;
      case TOP_GOT_POINTER_CAPTURE:
      case TOP_LOST_POINTER_CAPTURE:
      case TOP_POINTER_CANCEL:
      case TOP_POINTER_DOWN:
      case TOP_POINTER_MOVE:
      case TOP_POINTER_OUT:
      case TOP_POINTER_OVER:
      case TOP_POINTER_UP:
        EventConstructor = SyntheticPointerEvent;
        break;
      default:
        {
          if (knownHTMLTopLevelTypes.indexOf(topLevelType) === -1) {
            warningWithoutStack$1(false, 'SimpleEventPlugin: Unhandled event type, `%s`. This warning ' + 'is likely caused by a bug in React. Please file an issue.', topLevelType);
          }
        }
        // HTML Events
        // @see http://www.w3.org/TR/html5/index.html#events-0
        EventConstructor = SyntheticEvent;
        break;
    }
    var event = EventConstructor.getPooled(dispatchConfig, targetInst, nativeEvent, nativeEventTarget);
    accumulateTwoPhaseDispatches(event);
    return event;
  }
};

