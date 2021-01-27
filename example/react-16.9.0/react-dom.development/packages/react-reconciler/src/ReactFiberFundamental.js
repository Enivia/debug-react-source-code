

function createFundamentalStateInstance(currentFiber, props, impl, state) {
  return {
    currentFiber: currentFiber,
    impl: impl,
    instance: null,
    prevProps: null,
    props: props,
    state: state
  };
}