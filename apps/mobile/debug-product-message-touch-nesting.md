# Debug Session: product-message-touch-nesting
- **Status**: [OPEN]
- **Issue**: Opening or rendering product message cards in the conversation screen triggers `Error: Nesting touch handlers with native animated driver is not supported yet`.
- **Debug Server**: http://10.29.160.242:7777/event
- **Log File**: `.dbg/trae-debug-log-product-message-touch-nesting.ndjson`

## Reproduction Steps
1. Open a conversation containing a product message card.
2. Let the message list render, or interact with the product card if needed.
3. Observe the runtime error and stack pointing to `ProductMessageCard`.

## Hypotheses & Verification
| ID | Hypothesis | Likelihood | Effort | Evidence |
|----|------------|------------|--------|----------|
| A | `ProductMessageCard` nests gesture handlers using the native animated driver. | High | Low | Strongly suspected from runtime stack + nested `PanGestureHandler`/`PinchGestureHandler` with `useNativeDriver: true`. |
| B | A parent wrapper in the conversation row already provides a gesture handler, and `ProductMessageCard` adds another nested touch handler. | High | Low | Weakened by direct render path in `renderChatItem`, which returns `ProductMessageCard` without a gesture wrapper. |
| C | A child widget inside `ProductMessageCard` uses a secondary pressable layer only for image/product preview, creating the invalid nesting. | Medium | Low | Still possible, but less likely than A. |
| D | The error is triggered only on a specific render branch, such as seller/client/product availability state. | Medium | Medium | Pending post-fix verification logs. |
| E | The crash comes from an indirect shared component reused by `ProductMessageCard`, not from the card root itself. | Medium | Medium | Currently unsupported by the stack. |

## Log Evidence
- Instrumentation added in `src/components/ProductMessageCard.tsx` and `app/conversation/[id].tsx`.
- Pending fresh reproduction on `runId=pre-fix`.
- Debug server connectivity confirmed from shell (`200 OK`).
- Current log file is still empty after instrumentation: no app-side event captured yet.

## Verification Conclusion
- Minimal fix applied: switched nested gesture animations in `ProductMessageCard` from `useNativeDriver: true` to `useNativeDriver: false`.
- Awaiting post-fix user verification and post-fix logs.
