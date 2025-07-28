# Performance Optimizations for Input Lag

This document outlines the performance optimizations implemented to reduce input lag in the chat platform.

## Issues Identified

1. **Heavy React Markdown rendering** - Each message part was being rendered with ReactMarkdown without memoization
2. **Multiple state updates** - Usage stats fetching and multiple useEffect hooks causing unnecessary re-renders
3. **Complex component re-renders** - Large message components with many conditional renders
4. **Inefficient list rendering** - No virtualization for long chat histories
5. **Heavy DOM manipulation** - Complex nested components with many conditional elements

## Optimizations Implemented

### 1. React.memo and Component Memoization

All major components have been wrapped with `React.memo` to prevent unnecessary re-renders:

- `ChatMessage` component
- `ReasoningSteps` component
- `SearchSources` component
- `UsageStatsDisplay` component
- `ChatInput` component

### 2. useMemo and useCallback Hooks

Expensive computations and event handlers are now memoized:

```typescript
// Memoized computed values
const isAtLimit = useMemo(
  () =>
    usageStats && !usageStats.isAdmin
      ? usageStats.totalRequests >= usageStats.limit
      : false,
  [usageStats],
);

// Memoized event handlers
const handleInputChangeOptimized = useCallback(
  (e: React.ChangeEvent<HTMLInputElement>) => {
    measureInputLatency(() => {
      handleInputChange(e);
    });
  },
  [handleInputChange, measureInputLatency],
);
```

### 3. Optimized ReactMarkdown Rendering

ReactMarkdown components are now memoized to prevent re-rendering on every input change:

```typescript
const Markdown = memo(({ children }: { children: string }) => {
  return <ReactMarkdown components={components}>{children}</ReactMarkdown>;
});
```

### 4. Performance Monitoring

Added a performance monitoring system to track:

- Input latency
- Render time
- FPS (Frames Per Second)
- Memory usage

Enable the performance monitor by clicking the "Show Perf" button in the top-right corner.

### 5. Utility Functions

Added performance utility functions in `src/utils.ts`:

- `debounce()` - Limits function call frequency
- `throttle()` - Ensures function is called at most once per time period
- `memoize()` - Caches expensive computations
- `batchDOMUpdates()` - Batches DOM updates using requestAnimationFrame
- `addPassiveScrollListener()` - Optimizes scroll performance

### 6. Component Structure Optimization

- Split large components into smaller, focused components
- Extracted reusable logic into custom hooks
- Improved key props for list rendering
- Reduced conditional rendering complexity

## Usage

### Performance Monitor

The performance monitor can be enabled by clicking the "Show Perf" button. It displays:

- **FPS**: Current frames per second
- **Render**: Time taken for the last render cycle
- **Input**: Input latency in milliseconds
- **Memory**: Current memory usage (if available)

### Debugging Input Lag

1. Enable the performance monitor
2. Type in the input field and observe the "Input" latency
3. Check the browser console for detailed performance metrics
4. Look for components with high render times

## Best Practices

### For Developers

1. **Always use React.memo for components** that receive props but don't need frequent updates
2. **Memoize expensive computations** with useMemo
3. **Use useCallback for event handlers** passed as props
4. **Optimize list rendering** with proper keys and virtualization for large lists
5. **Batch state updates** to reduce re-render cycles

### For Performance Monitoring

1. **Monitor input latency** - Should be under 16ms for smooth 60fps
2. **Watch FPS** - Should stay above 50fps for good user experience
3. **Check memory usage** - Look for memory leaks in long-running sessions
4. **Profile render times** - Components should render in under 16ms

## Future Optimizations

1. **Virtual scrolling** for very long chat histories
2. **Lazy loading** for message components outside viewport
3. **Web Workers** for heavy computations
4. **Service Worker** for caching and offline support
5. **Code splitting** to reduce initial bundle size

## Troubleshooting

### High Input Latency (>16ms)

1. Check for expensive computations in render cycles
2. Look for components that re-render unnecessarily
3. Verify that React.memo is properly implemented
4. Check for memory leaks causing garbage collection

### Low FPS (<50fps)

1. Reduce the number of DOM elements
2. Optimize CSS animations and transitions
3. Use `transform` and `opacity` for animations
4. Implement virtualization for long lists

### High Memory Usage

1. Check for memory leaks in useEffect cleanup
2. Verify that event listeners are properly removed
3. Look for large objects being stored in state
4. Consider implementing object pooling for frequently created objects
