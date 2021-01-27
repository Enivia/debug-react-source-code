var enableUserTimingAPI = true;

// Helps identify side effects in begin-phase lifecycle hooks and setState reducers:
var debugRenderPhaseSideEffects = false;

// In some cases, StrictMode should also double-render lifecycles.
// This can be confusing for tests though,
// And it can be bad for performance in production.
// This feature flag can be used to control the behavior:
var debugRenderPhaseSideEffectsForStrictMode = true;

// To preserve the "Pause on caught exceptions" behavior of the debugger, we
// replay the begin phase of a failed component inside invokeGuardedCallback.
var replayFailedUnitOfWorkWithInvokeGuardedCallback = true;

// Warn about deprecated, async-unsafe lifecycles; relates to RFC #6:
var warnAboutDeprecatedLifecycles = true;

// Gather advanced timing metrics for Profiler subtrees.
var enableProfilerTimer = true;

// Trace which interactions trigger each commit.
var enableSchedulerTracing = true;

// Only used in www builds.
var enableSuspenseServerRenderer = false; // TODO: true? Here it might just be false.

// Only used in www builds.


// Only used in www builds.


// Disable javascript: URL strings in href for XSS protection.
var disableJavaScriptURLs = false;

// React Fire: prevent the value and checked attributes from syncing
// with their related DOM properties
var disableInputAttributeSyncing = false;

// These APIs will no longer be "unstable" in the upcoming 16.7 release,
// Control this behavior with a flag to support 16.6 minor releases in the meanwhile.
var enableStableConcurrentModeAPIs = false;

var warnAboutShorthandPropertyCollision = false;

// See https://github.com/react-native-community/discussions-and-proposals/issues/72 for more information
// This is a flag so we can fix warnings in RN core before turning it on


// Experimental React Flare event system and event components support.
var enableFlareAPI = false;

// Experimental Host Component support.
var enableFundamentalAPI = false;

// New API for JSX transforms to target - https://github.com/reactjs/rfcs/pull/107


// We will enforce mocking scheduler with scheduler/unstable_mock at some point. (v17?)
// Till then, we warn about the missing mock, but still fallback to a sync mode compatible version
var warnAboutUnmockedScheduler = false;
// Temporary flag to revert the fix in #15650
var revertPassiveEffectsChange = false;

// For tests, we flush suspense fallbacks in an act scope;
// *except* in some of our own tests, where we test incremental loading states.
var flushSuspenseFallbacksInTests = true;

// Changes priority of some events like mousemove to user-blocking priority,
// but without making them discrete. The flag exists in case it causes
// starvation problems.
var enableUserBlockingEvents = false;

// Add a callback property to suspense to notify which promises are currently
// in the update queue. This allows reporting and tracing of what is causing
// the user to see a loading state.
var enableSuspenseCallback = false;

// Part of the simplification of React.createElement so we can eventually move
// from React.createElement to React.jsx
// https://github.com/reactjs/rfcs/blob/createlement-rfc/text/0000-create-element-changes.md
var warnAboutDefaultPropsOnFunctionComponents = false;

var disableLegacyContext = false;

var disableSchedulerTimeoutBasedOnReactExpirationTime = false;