# RPC Service Refactoring Implementation Plan

## Overview

This plan provides a step-by-step approach to refactoring the RPC service codebase based on the audit findings. The refactoring aims to reduce complexity while maintaining all existing functionality.

## Phase 1: Data Structure Simplification (Priority: HIGH)

### 1.1 Remove EndpointCollection Type
**Effort**: 2-3 hours  
**Risk**: Low  
**Files to modify**:
- `src/types.ts`
- `src/utils/createEndpointCollection.ts` (delete)
- `src/utils/fetchExternalEndpoints.ts`
- `src/utils/filterEndpoints.ts`
- `src/utils/processTestResults.ts`

**Steps**:
1. Remove `EndpointCollection` type from `types.ts`
2. Delete `createEndpointCollection.ts`
3. Update `fetchExternalEndpoints` to return `RpcEndpoint[]`
4. Simplify `filterEndpoints` to accept and return `RpcEndpoint[]`
5. Update all consumers of these functions

### 1.2 Consolidate Extraction Functions
**Effort**: 2 hours  
**Risk**: Low  
**Files to modify**:
- `src/utils/parsers.ts`

**Steps**:
1. Create generic `extractEndpoints` function
2. Replace individual extraction functions with calls to generic function
3. Update tests if applicable

## Phase 2: Core Logic Simplification (Priority: HIGH)

### 2.1 Simplify Test Result Processing
**Effort**: 3-4 hours  
**Risk**: Medium  
**Files to modify**:
- `src/utils/processTestResults.ts`
- `src/services/rpcTester.ts`

**Steps**:
1. Remove complex chain ID to network name mapping
2. Use chain ID as consistent identifier throughout
3. Simplify chain ID mismatch handling (either reject or accept dominant)
4. Remove `TestResultsCollection` type, use simpler return type

### 2.2 Streamline Main Function Flow
**Effort**: 2 hours  
**Risk**: Low  
**Files to modify**:
- `src/main.ts`

**Steps**:
1. Reduce intermediate variables
2. Combine related operations
3. Make data flow more linear

## Phase 3: Code Cleanup (Priority: MEDIUM)

### 3.1 Remove Unused Code
**Effort**: 1 hour  
**Risk**: None  
**Files to modify**:
- `src/services/fileService.ts` (remove `generateSupportedChainsFile`)
- `src/services/rpcTester.ts` (remove unused error classes)

**Steps**:
1. Delete `generateSupportedChainsFile` function
2. Remove `RpcTestError` and `RpcTimeoutError` classes
3. Update error handling to use standard Error

### 3.2 Simplify Filter Logic
**Effort**: 2 hours  
**Risk**: Low  
**Files to modify**:
- `src/utils/filterEndpoints.ts`

**Steps**:
1. Split into composable functions: sanitize, filter blacklist, deduplicate
2. Remove complex statistics tracking
3. Use functional composition

## Phase 4: Statistics Refactoring (Priority: LOW)

### 4.1 Consolidate Statistics Logic
**Effort**: 3-4 hours  
**Risk**: Low  
**Files to modify**:
- `src/utils/stats/` (all files)

**Steps**:
1. Create single `StatsCollector` class
2. Collect statistics during processing, not after
3. Simplify display logic
4. Remove separate "missing networks" logic

### 4.2 Remove Configuration Redundancy
**Effort**: 1 hour  
**Risk**: Low  
**Files to modify**:
- `src/constants/config.ts`
- Files using config values

**Steps**:
1. Ensure all defaults are in config
2. Remove nullish coalescing operators where redundant
3. Add TypeScript strict null checks

## Phase 5: Type System Improvements (Priority: LOW)

### 5.1 Simplify Type Definitions
**Effort**: 2 hours  
**Risk**: Low  
**Files to modify**:
- `src/types.ts`

**Steps**:
1. Remove redundant interface variations
2. Use consistent naming conventions
3. Add proper JSDoc comments
4. Consider using discriminated unions where appropriate

## Implementation Schedule

### Week 1
- Phase 1.1: Remove EndpointCollection
- Phase 1.2: Consolidate extraction functions
- Phase 2.1: Begin test result processing simplification

### Week 2
- Phase 2.1: Complete test result processing
- Phase 2.2: Streamline main function
- Phase 3.1: Remove unused code
- Phase 3.2: Simplify filter logic

### Week 3 (if resources available)
- Phase 4: Statistics refactoring
- Phase 5: Type system improvements

## Testing Strategy

1. **Unit Tests**: Add tests for new simplified functions
2. **Integration Tests**: Ensure output files remain identical
3. **Performance Tests**: Verify no performance degradation
4. **Regression Tests**: Run against production data

## Success Metrics

- **Code Reduction**: Target 20-30% reduction in lines of code
- **Complexity**: Reduce cyclomatic complexity by 40%
- **Performance**: Maintain or improve current performance
- **Maintainability**: Improve code clarity and reduce cognitive load

## Rollback Plan

1. All changes should be made in a feature branch
2. Keep original functionality until new implementation is verified
3. Run parallel testing with old and new implementations
4. Maintain ability to switch between implementations via feature flag

## Post-Refactoring Tasks

1. Update documentation
2. Update developer onboarding guides
3. Create architecture decision records (ADRs)
4. Schedule knowledge sharing session with team

## Risk Mitigation

- **Data Loss**: Ensure all RPC endpoints are still captured
- **Performance**: Monitor request handling and response times
- **Compatibility**: Verify output format remains unchanged
- **Git Integration**: Test git operations thoroughly

## Conclusion

This refactoring plan provides a systematic approach to simplifying the RPC service while maintaining functionality. The phased approach allows for incremental improvements with minimal risk. Priority should be given to Phase 1 and 2 as they provide the most significant improvements in code clarity and maintainability.