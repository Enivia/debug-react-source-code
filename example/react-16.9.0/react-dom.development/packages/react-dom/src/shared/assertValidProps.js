// TODO: We can remove this if we add invariantWithStack()
// or add stack by default to invariants where possible.
var HTML$1 = '__html';

var ReactDebugCurrentFrame$3 = null;
{
  ReactDebugCurrentFrame$3 = ReactSharedInternals.ReactDebugCurrentFrame;
}

function assertValidProps(tag, props) {
  if (!props) {
    return;
  }
  // Note the use of `==` which checks for null or undefined.
  if (voidElementTags[tag]) {
    (function () {
      if (!(props.children == null && props.dangerouslySetInnerHTML == null)) {
        {
          throw ReactError(Error(tag + ' is a void element tag and must neither have `children` nor use `dangerouslySetInnerHTML`.' + (ReactDebugCurrentFrame$3.getStackAddendum())));
        }
      }
    })();
  }
  if (props.dangerouslySetInnerHTML != null) {
    (function () {
      if (!(props.children == null)) {
        {
          throw ReactError(Error('Can only set one of `children` or `props.dangerouslySetInnerHTML`.'));
        }
      }
    })();
    (function () {
      if (!(typeof props.dangerouslySetInnerHTML === 'object' && HTML$1 in props.dangerouslySetInnerHTML)) {
        {
          throw ReactError(Error('`props.dangerouslySetInnerHTML` must be in the form `{__html: ...}`. Please visit https://fb.me/react-invariant-dangerously-set-inner-html for more information.'));
        }
      }
    })();
  }
  {
    !(props.suppressContentEditableWarning || !props.contentEditable || props.children == null) ? warning$1(false, 'A component is `contentEditable` and contains `children` managed by ' + 'React. It is now your responsibility to guarantee that none of ' + 'those nodes are unexpectedly modified or duplicated. This is ' + 'probably not intentional.') : void 0;
  }
  (function () {
    if (!(props.style == null || typeof props.style === 'object')) {
      {
        throw ReactError(Error('The `style` prop expects a mapping from style properties to values, not a string. For example, style={{marginRight: spacing + \'em\'}} when using JSX.' + (ReactDebugCurrentFrame$3.getStackAddendum())));
      }
    }
  })();
}

