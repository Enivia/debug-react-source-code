
var Scheduler = Object.freeze({
	unstable_ImmediatePriority: ImmediatePriority,
	unstable_UserBlockingPriority: UserBlockingPriority,
	unstable_NormalPriority: NormalPriority,
	unstable_IdlePriority: IdlePriority,
	unstable_LowPriority: LowPriority,
	unstable_runWithPriority: unstable_runWithPriority,
	unstable_next: unstable_next,
	unstable_scheduleCallback: unstable_scheduleCallback,
	unstable_cancelCallback: unstable_cancelCallback,
	unstable_wrapCallback: unstable_wrapCallback,
	unstable_getCurrentPriorityLevel: unstable_getCurrentPriorityLevel,
	unstable_shouldYield: unstable_shouldYield,
	unstable_requestPaint: unstable_requestPaint,
	unstable_continueExecution: unstable_continueExecution,
	unstable_pauseExecution: unstable_pauseExecution,
	unstable_getFirstCallbackNode: unstable_getFirstCallbackNode,
	get unstable_now () { return getCurrentTime; },
	get unstable_forceFrameRate () { return forceFrameRate; }
});
