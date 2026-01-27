# Super-Dev Changelog

## [1.4.0] - 2026-01-27

### Fixed - Skill Configuration and Invocation

#### Issue 1: Skill Not User-Invocable
**Problem:** The `/super-dev` command failed with "No task found with ID: super-dev:super-dev"

**Root Cause:** The main skill `skills/super-dev/SKILL.md` lacked `user-invocable: true` in its YAML frontmatter, preventing users from invoking it directly.

**Solution:** Added `user-invocable: true` and comprehensive trigger phrases to the skill metadata.

#### Issue 2: Incorrect Skill Reference in Command
**Problem:** Command file referenced skill with wrong syntax (`super-dev:super-dev`)

**Root Cause:** The command used `super-dev:super-dev` instead of the correct `@skills/super-dev` syntax.

**Solution:** Updated command file to use `@skills/super-dev` for proper skill invocation.

#### Issue 3: Missing Commands Field in Plugin Manifest
**Problem:** Plugin manifest didn't explicitly declare the commands directory.

**Root Cause:** The `plugin.json` lacked the `commands` field to indicate where command files are located.

**Solution:** Added `"commands": "./commands"` to the plugin manifest.

### Changes Summary

#### Modified Files
1. **skills/super-dev/SKILL.md**
   - Added `user-invocable: true`
   - Added trigger phrases: "plan a feature", "evaluate a feature", "review a feature proposal", etc.

2. **commands/super-dev.md**
   - Changed `super-dev:super-dev` → `@skills/super-dev`

3. **.claude-plugin/plugin.json**
   - Added `"commands": "./commands"`
   - Updated version to 1.4.0

### Expected Behavior After Fix

**Before:**
```
User: /super-dev add notifications
Error: No task found with ID: super-dev:super-dev
```

**After:**
```
User: /super-dev add notifications
🚀 Super-Dev: Multi-Agent Feature Review
[Proceeds with proposal builder Q&A]
```

### Testing Recommendations

1. Test command invocation: `/super-dev add notifications`
2. Verify skill properly launches the proposal builder
3. Verify all 5 judge agents run in parallel
4. Verify final report is displayed correctly

---

## [1.3.0] - 2026-01-26

### Fixed - Critical Visibility and Role Issues

#### Issue 1: No Judge Verdicts Visible
**Problem:** When super-dev ran as a sub-agent, users couldn't see judge verdicts (APPROVE/REJECT) or the detailed analysis report.

**Root Cause:** The skill processed judge outputs internally but didn't explicitly OUTPUT them, so they remained invisible when running in a sub-agent.

**Solution:** Added explicit output requirements throughout the skill:
- Phase 2: Output judge verdict summary immediately after all judges complete
- Phase 4: Must OUTPUT the complete formatted report (not just process it internally)
- Added "CRITICAL for Sub-Agent Execution" section emphasizing output visibility

#### Issue 2: Implementation Behavior
**Problem:** Super-dev was acting as an implementation skill, continuing to build features after evaluation.

**Root Cause:** No clear role boundary. The skill evaluated proposals but didn't stop - it would offer to implement or start implementation automatically.

**Solution:** Added explicit role definition:
- New "⚠️ CRITICAL: Role Definition" section at the top
- Clarified: This is PLANNING and INSPECTION ONLY
- Added explicit STOP instructions after presenting the final report
- Prohibited implementation, code changes, and file creation

### Changes Summary

#### Added Sections
1. **Role Definition** (lines 10-24)
   - Planning and inspection only
   - Output requirements for sub-agents
   - Stop after planning

2. **Output Requirements in Phase 2** (lines 163-171)
   - Immediately output judge verdict summary
   - Ensures visibility when running in sub-agent

3. **Enhanced Phase 4 Instructions** (lines 220-240)
   - MUST output complete report
   - Include ALL judge verdicts with reasoning
   - STOP after outputting - no implementation
   - Clear role boundaries (advisory only)

4. **Critical Sub-Agent Execution Note** (lines 321-322)
   - Emphasizes output requirement
   - Explains visibility issue

#### Modified Sections
1. **Example Execution** (lines 413-418)
   - Shows judge verdict summary output
   - Demonstrates proper transparency

2. **User Communication** (lines 307-323)
   - Added judge verdict summary in Phase 2
   - Added "OUTPUT THE COMPLETE FORMATTED REPORT" instruction
   - Added "Then STOP" instruction

### Expected Behavior After Fix

**Before:**
```
User: /super-dev add notifications
[Sub-agent runs silently]
Response: "Feature evaluation complete"
User: [No idea what the verdict was]
```

**After:**
```
User: /super-dev add notifications
[Sub-agent runs with visible progress]

✅ All 5 judges completed:
   - Pragmatist: APPROVE
   - Purist: REJECT
   - Innovator: APPROVE
   - Skeptic: REJECT
   - Optimizer: APPROVE

## 🎯 Feature Review: User Notifications

**Final Decision: ⚠️ NEEDS REVISION**
**Vote Breakdown:** 3 Approve, 2 Reject

### 📊 Judge Verdicts
[Full details for each judge...]

[Complete formatted report...]

**Next Steps:**
[Clear guidance...]

[STOPS HERE - no implementation offered]
```

### Testing Recommendations

1. Test with vague request: `/super-dev add notifications`
2. Test with file: `/super-dev --file proposal.md`
3. Verify all judge verdicts are visible
4. Verify complete report is displayed
5. Verify skill stops after report (no implementation)
6. Verify works correctly when run in sub-agent via Skill tool

### Breaking Changes

None. This is a bug fix release that restores intended behavior.

### Migration Notes

No migration needed. Users running v1.0, v1.1, or v1.2 will automatically get the visibility fixes when they upgrade to v1.3.0.

---

**Version:** 1.3.0
**Date:** 2026-01-26
**Author:** JuniYadi
