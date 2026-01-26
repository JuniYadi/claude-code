---
name: vote-aggregator
description: Combine 5 independent judge verdicts into actionable final recommendation.
---

# Vote Aggregator

Combine 5 independent judge verdicts into actionable final recommendation.

## Purpose

After all 5 judges (Pragmatist, Purist, Innovator, Skeptic, Optimizer) evaluate a proposal independently, this skill synthesizes their feedback into a clear go/no-go decision with actionable next steps.

## Input

```typescript
interface AggregatorInput {
  verdicts: JudgeVerdict[];  // Array of 5 verdicts
  parsedProposal: ParsedProposal;  // Original proposal for context
}

interface JudgeVerdict {
  judgeName: string;  // "Pragmatist", "Purist", etc.
  verdict: "APPROVE" | "REJECT";
  reasoning: string;
  keyConcerns: string[];
  suggestions: string[];
}
```

## Processing Steps

### Step 1: Count Votes

```markdown
Tally verdicts:
- Count APPROVE votes
- Count REJECT votes
- Track which judges voted which way

Example:
{
  approve: 3,
  reject: 2,
  judges: {
    approve: ["Pragmatist", "Innovator", "Optimizer"],
    reject: ["Purist", "Skeptic"]
  }
}
```

### Step 2: Determine Final Decision

```markdown
**Decision Matrix:**

5 APPROVE, 0 REJECT → APPROVED (unanimous)
4 APPROVE, 1 REJECT → APPROVED (strong consensus)
3 APPROVE, 2 REJECT → NEEDS_REVISION (split decision)
2 APPROVE, 3 REJECT → NEEDS_REVISION (major concerns)
0-1 APPROVE, 4-5 REJECT → REJECTED (strong opposition)

**Rationale:**
- 4-5 approvals = Clear green light, address concerns during implementation
- 3 approvals = Mixed signals, need to address rejecting judges' concerns first
- 0-2 approvals = Fundamental issues, requires redesign

Note: "NEEDS_REVISION" means "fix these specific things and resubmit"
```

### Step 3: Extract Common Themes

```markdown
Analyze all 5 verdicts to identify patterns:

**Strengths (Mentioned by 2+ judges):**
- Parse all `reasoning` and `suggestions` for positive points
- Look for common praise
- Example: Both Pragmatist and Innovator mention "good user value"

**Concerns (Mentioned by 2+ judges):**
- Parse all `keyConcerns` arrays
- Identify overlapping worries
- Example: Both Skeptic and Optimizer mention "scalability"

**Critical Issues (From rejecting judges):**
- All concerns from judges who voted REJECT
- These MUST be addressed for approval
- Security issues from Skeptic = CRITICAL
- Architecture issues from Purist = CRITICAL

**Grouping by Theme:**
- Architecture (Purist concerns)
- Security (Skeptic concerns)
- Performance (Optimizer concerns)
- Scope (Pragmatist concerns)
- Innovation (Innovator concerns)
```

### Step 4: Synthesize Recommendations

```markdown
Combine suggestions into coherent action items:

**Deduplication:**
- Multiple judges suggest same thing = high priority
- Example: Pragmatist says "start with MVP", Innovator says "phase 1: basic features"
  → Combine as: "Implement phased approach (MVP first)"

**Prioritization:**
- Must-fix (from REJECT judges) = Highest priority
- Security/data issues = Highest priority
- Consensus suggestions (3+ judges) = High priority
- Nice-to-have (from APPROVE judges) = Medium priority
- Edge cases = Lower priority

**Categorization:**
If APPROVED:
- "Recommended Improvements" (optional, enhance quality)

If NEEDS_REVISION:
- "Must Address Before Implementation" (required for approval)
- "Recommended Improvements" (optional, enhance quality)

If REJECTED:
- "Critical Issues Requiring Redesign" (fundamental problems)
- "Recommended Approach" (alternative direction)
```

### Step 5: Generate Next Steps

```markdown
Based on decision, provide clear guidance:

**If APPROVED:**
- "Ready to implement!"
- List optional improvements to consider during development
- Note which judges suggested which improvements
- Remind to follow best practices from Purist review

**If NEEDS_REVISION:**
- "Revise proposal and resubmit"
- List specific items to address (numbered, actionable)
- Explain which judge raised each concern
- Suggest re-running `/super-dev --file proposal-v2.md` after fixes
- Estimate revision time if possible

**If REJECTED:**
- "Fundamental redesign needed"
- Explain core issues clearly
- Suggest alternative approaches (from judge feedback)
- Recommend consulting with team before resubmitting
- Possibly suggest breaking into smaller proposals
```

## Output Format

```markdown
## 🎯 Feature Review: [Feature Title]

**Final Decision: ✅ APPROVED** | **⚠️ NEEDS REVISION** | **❌ REJECTED**

**Vote Breakdown:** X Approve, Y Reject

---

### 📊 Judge Verdicts

**✅ Pragmatist:** APPROVE
> [1-2 sentence summary of their reasoning]

**❌ Purist:** REJECT
> [1-2 sentence summary of their reasoning]

**✅ Innovator:** APPROVE
> [1-2 sentence summary of their reasoning]

**❌ Skeptic:** REJECT
> [1-2 sentence summary of their reasoning]

**✅ Optimizer:** APPROVE
> [1-2 sentence summary of their reasoning]

<details>
<summary>📋 Detailed Analysis</summary>

### ✅ Strengths
- **[Theme]** (Judge1, Judge2): [Description]
- **[Theme]** (Judge3): [Description]

### ⚠️ Key Concerns
- **[Theme]** (Judge1, Judge2): [Description]
- **[Theme]** (Judge3): [Description]

### 🔴 Must Address Before Implementation
*(Only if NEEDS_REVISION or REJECTED)*

1. **[Issue Title]** ([Judge] - [CRITICAL/HIGH])
   - [Description of issue]
   - [Why it matters]
   - [How to address]

2. **[Issue Title]** ([Judge] - [HIGH])
   - ...

### 💡 Recommended Improvements
*(Optional improvements)*

- [Suggestion 1] ([Judge])
- [Suggestion 2] ([Judge1], [Judge2])

</details>

---

**Next Steps:**

[Decision-specific guidance as defined in Step 5]

---

*Generated by super-dev multi-agent review system*
```

## Example Outputs

### Example 1: APPROVED (4-1 Vote)

```markdown
## 🎯 Feature Review: Real-time User Notifications

**Final Decision: ✅ APPROVED**

**Vote Breakdown:** 4 Approve, 1 Reject

---

### 📊 Judge Verdicts

**✅ Pragmatist:** APPROVE
> Good user value with realistic scope. Can leverage existing EmailService for quick MVP.

**❌ Purist:** REJECT
> Missing architectural clarity. Needs proper interface design for notification channels.

**✅ Innovator:** APPROVE
> Excellent use of modern tech. WebSocket approach is forward-thinking.

**✅ Skeptic:** APPROVE with conditions
> Security addressed adequately. Add rate limiting before launch.

**✅ Optimizer:** APPROVE
> Performance strategy solid. Caching plan will handle scale well.

<details>
<summary>📋 Detailed Analysis</summary>

### ✅ Strengths
- **User Value** (Pragmatist, Innovator): Solves real user pain point with modern approach
- **Modern Technology** (Innovator, Optimizer): WebSocket + caching provides excellent UX at scale
- **Existing Infrastructure** (Pragmatist, Optimizer): Can reuse EmailService and queue system

### ⚠️ Key Concerns
- **Architecture** (Purist): Needs proper interface abstraction for notification channels
- **Rate Limiting** (Skeptic): Must prevent notification spam

### 💡 Recommended Improvements

1. **Add INotificationChannel interface** (Purist - HIGH)
   - Define interface for email, push, WebSocket channels
   - Allows adding new channels without modifying core logic
   - Makes testing easier with mock channels

2. **Implement rate limiting** (Skeptic - HIGH)
   - Max 10 notifications/minute per user
   - Prevents spam and abuse
   - Protects system resources

3. **Phase implementation** (Pragmatist)
   - Phase 1: Email notifications for mentions
   - Phase 2: Add WebSocket real-time
   - Reduces initial scope, faster to market

4. **Add notification grouping** (Innovator)
   - "5 new messages" vs 5 separate notifications
   - Better UX, reduces noise
   - Modern notification pattern

</details>

---

**Next Steps:**

✅ **Ready to implement!**

Address recommended improvements during development:
1. Start with interface design (INotificationChannel) for clean architecture
2. Implement rate limiting before launch (security requirement)
3. Consider phased rollout (mentions first, then expand)
4. Add smart grouping for better UX

Follow architecture guidelines from Purist review and security recommendations from Skeptic for production-ready implementation.

---

*Generated by super-dev multi-agent review system*
```

### Example 2: NEEDS REVISION (3-2 Vote)

```markdown
## 🎯 Feature Review: Advanced User Analytics Dashboard

**Final Decision: ⚠️ NEEDS REVISION**

**Vote Breakdown:** 3 Approve, 2 Reject

---

### 📊 Judge Verdicts

**✅ Pragmatist:** APPROVE
> Scope is ambitious but achievable in phases. Recommend starting with core metrics only.

**❌ Purist:** REJECT
> No data model design specified. Missing details on how analytics are collected, stored, and aggregated.

**✅ Innovator:** APPROVE
> Modern visualization approach. Chart.js + real-time updates will create excellent UX.

**❌ Skeptic:** REJECT
> Major privacy concerns. GDPR compliance not addressed. No data retention policy defined.

**✅ Optimizer:** APPROVE with conditions
> Need caching strategy for expensive aggregations. Current approach will hit database hard.

<details>
<summary>📋 Detailed Analysis</summary>

### ✅ Strengths
- **Modern Visualization** (Innovator, Pragmatist): Chart.js provides excellent user experience
- **Phased Approach** (Pragmatist): Willing to start with core metrics and expand

### ⚠️ Key Concerns
- **Data Architecture** (Purist, Optimizer): No schema design for analytics storage
- **Privacy & Compliance** (Skeptic): GDPR requirements not addressed
- **Performance** (Optimizer): Aggregation queries will be expensive without caching

### 🔴 Must Address Before Implementation

1. **Define Data Model and Schema** (Purist - CRITICAL)
   - Design events table structure
   - Define aggregation tables for performance
   - Specify indexes for common queries
   - Document data retention strategy

2. **Address GDPR Compliance** (Skeptic - CRITICAL)
   - User consent mechanism for tracking
   - Data export capability (user data download)
   - Right to be forgotten (data deletion)
   - Privacy policy updates
   - Data retention limits (e.g., 90 days)

3. **Add Caching Strategy** (Optimizer - HIGH)
   - Cache aggregated metrics (Redis, 5-10 min TTL)
   - Pre-compute daily/weekly stats
   - Use materialized views for complex aggregations
   - Define cache invalidation strategy

4. **Reduce Initial Scope** (Pragmatist - MEDIUM)
   - Start with 5 core metrics only
   - Defer advanced analytics to Phase 2
   - Focus on most requested user insights

### 💡 Recommended Improvements

- Real-time updates via WebSocket (Innovator)
- Export to CSV functionality (Skeptic)
- Responsive design for mobile (Innovator)
- A/B test visualization options (Pragmatist)

</details>

---

**Next Steps:**

⚠️ **Revise proposal and resubmit:**

1. **Add data architecture section** with:
   - Event schema design (table structure, fields, types)
   - Aggregation table design
   - Index strategy
   - Data retention policy (e.g., raw events 30 days, aggregates 1 year)

2. **Add privacy & compliance section** with:
   - GDPR compliance checklist
   - User consent flow
   - Data export/deletion procedures
   - Privacy policy impact

3. **Add performance section** with:
   - Caching strategy (what, where, TTL)
   - Pre-computation plan for heavy aggregations
   - Database optimization approach

4. **Reduce scope** (recommended):
   - Define Phase 1: Core 5 metrics
   - Define Phase 2: Advanced analytics
   - Focus initial proposal on Phase 1 only

Once revised with these sections, re-run:
`/super-dev --file docs/proposals/analytics-dashboard-v2.md`

**Estimated revision time:** 2-3 hours
**Expected outcome after revision:** APPROVED (if critical items addressed)

---

*Generated by super-dev multi-agent review system*
```

### Example 3: REJECTED (1-4 Vote)

```markdown
## 🎯 Feature Review: Complete Platform Rewrite with Microservices

**Final Decision: ❌ REJECTED**

**Vote Breakdown:** 1 Approve, 4 Reject

---

### 📊 Judge Verdicts

**❌ Pragmatist:** REJECT
> Massively over-scoped. This is 6-12 months of work disguised as a feature. No clear Phase 1 or MVP.

**❌ Purist:** REJECT
> Microservices add enormous complexity. No justification for why monolith is insufficient. Architectural overkill.

**✅ Innovator:** APPROVE with concerns
> Modern architecture approach, but scope is too broad. Need clearer migration strategy.

**❌ Skeptic:** REJECT
> Switching to microservices introduces network failures, distributed transactions, debugging nightmares. Risk >> benefit.

**❌ Optimizer:** REJECT
> Microservices add latency (network calls), operational complexity, and cost. Current monolith performance is fine.

<details>
<summary>📋 Detailed Analysis</summary>

### ⚠️ Key Concerns
- **Massive Scope** (Pragmatist, Purist): 6-12 month project, not a feature
- **Unjustified Complexity** (Purist, Skeptic, Optimizer): Microservices solve problems we don't have
- **High Risk** (Skeptic): Distributed systems add failure modes
- **Performance Regression** (Optimizer): Network latency will slow down operations

### 🔴 Critical Issues Requiring Redesign

1. **Scope Reduction Needed** (Pragmatist - CRITICAL)
   - Current proposal tries to solve everything at once
   - No phased approach or rollback plan
   - This is not a "feature" - it's a multi-quarter initiative

2. **Justify Architecture Change** (Purist, Optimizer - CRITICAL)
   - Why is monolith insufficient?
   - What specific problems does microservices solve?
   - What's the performance/scale target that requires this?
   - Cost/benefit analysis missing

3. **Risk Analysis Missing** (Skeptic - CRITICAL)
   - Distributed transactions not addressed
   - Network failure handling unclear
   - Data consistency strategy undefined
   - Rollback plan missing

### 💡 Recommended Approach

Instead of full rewrite to microservices, consider:

**Phase 1: Identify Actual Problem**
- What's slow/broken in current system?
- Where are the actual bottlenecks?
- What user problems need solving?

**Phase 2: Targeted Improvements**
- Extract ONE service if truly needed (not entire platform)
- Add caching/optimization to existing system
- Refactor problematic modules within monolith

**Phase 3: Evaluate Success**
- Did targeted improvements solve the problem?
- Is further extraction justified?
- Measure before deciding on more changes

**Alternative Proposals:**
- Extract high-load service (e.g., notification service) as separate app
- Add API layer in front of monolith (strangler pattern)
- Modularize monolith first (easier to extract later if needed)

</details>

---

**Next Steps:**

❌ **Fundamental redesign needed:**

This proposal attempts to solve problems that may not exist with an approach that introduces significant complexity and risk.

**Recommended process:**
1. **Document actual problems** with current architecture
   - What's slow? (with metrics)
   - What's hard to maintain? (with examples)
   - What's preventing team velocity? (specific blockers)

2. **Explore targeted solutions** before wholesale rewrite
   - Can caching solve performance issues?
   - Can refactoring solve maintenance issues?
   - Can better tooling solve velocity issues?

3. **If microservices still needed**, submit focused proposal:
   - Extract ONE service (not entire platform)
   - Clear problem statement (what does this solve?)
   - Migration strategy (how to transition safely?)
   - Rollback plan (what if it doesn't work?)
   - Cost/benefit analysis

4. **Consider alternatives:**
   - Modular monolith (better than microservices for most apps)
   - Service extraction only where truly needed
   - Performance optimization of existing system

Consult with team and stakeholders before submitting revised approach.

---

*Generated by super-dev multi-agent review system*
```

## Edge Cases

**All Judges APPROVE (5-0):**
- Rare but possible
- Note unanimous approval
- Still provide suggestions for excellence

**All Judges REJECT (0-5):**
- Very rare
- Indicates fundamental issues
- Recommend starting over with different approach

**4 REJECT, 1 APPROVE:**
- Strong rejection signal
- Treat similar to 0-5 REJECT
- Final decision: REJECTED

**Judge Verdict Fails/Missing:**
- If 1-2 judges fail: Continue with remaining
- Adjust decision matrix (3/4 approve = APPROVED)
- Note missing verdicts in output
- If 3+ judges fail: Cannot make decision, report error

## Success Criteria

**Good Aggregation:**
- Clear final decision
- Actionable next steps
- Prioritized concerns
- Deduplicated suggestions
- Balanced perspective

**Poor Aggregation:**
- Vague decision
- Unclear what to do next
- Dumping all concerns without priority
- Duplicate suggestions
- Ignoring minority views

## Usage

This skill is used in Phase 3 of super-dev:

```
5 Judge verdicts (parallel) → vote-aggregator → Final recommendation → Present to user
```

The output is the final deliverable shown to the user for decision-making.
