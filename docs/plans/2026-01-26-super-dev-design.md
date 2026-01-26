# Super-Dev: Multi-Agent Feature Planning System

**Date:** 2026-01-26
**Status:** Design Approved
**Type:** Skill Development

---

## Overview

Super-dev is a skill orchestration system for feature planning with multi-agent judgement. It transforms vague user requests into structured proposals, then evaluates them through 5 independent judge agents with different perspectives, producing actionable go/no-go decisions.

**Key Difference from issue-reviews:**
- **issue-reviews**: Reactive (fix existing bugs)
- **super-dev**: Proactive (validate new features before implementation)

---

## Goals

1. **Intelligent Proposal Generation**: Transform vague requests ("add notifications to Laravel") into structured proposals through guided Q&A
2. **Multi-Perspective Analysis**: Evaluate features through 5 independent judge agents (Pragmatist, Purist, Innovator, Skeptic, Optimizer)
3. **Actionable Decisions**: Produce clear APPROVED/NEEDS_REVISION/REJECTED verdicts with specific feedback
4. **Prevent Costly Mistakes**: Identify risks and issues before implementation starts

---

## High-Level Flow

```
User Request (vague or structured)
    ↓
Phase 0: Proposal Builder (if needed)
    - Detect completeness
    - Ask clarifying questions
    - Auto-generate structured proposal
    - Get user confirmation
    ↓
Phase 1: Parse & Analyze
    - feature-parser: Extract goals, requirements, constraints
    - codebase-analyzer: Find existing patterns, tech stack
    ↓
Phase 2: Parallel Judgement (5 agents simultaneously)
    ├─ Pragmatist: Practical feasibility
    ├─ Purist: Best practices & standards
    ├─ Innovator: Creative solutions
    ├─ Skeptic: Find problems & risks
    └─ Optimizer: Performance & efficiency
    ↓
Phase 3: Vote Aggregation
    - Count votes (APPROVE vs REJECT)
    - Extract common themes
    - Synthesize recommendations
    ↓
Phase 4: Present Final Report
    - Decision: APPROVED/NEEDS_REVISION/REJECTED
    - Detailed verdict from each judge
    - Must-fix items and suggestions
    - Clear next steps
```

**Expected Duration:** 2-6 minutes (thanks to parallel execution)

---

## File Structure

```
/home/juniyadi/github/JuniYadi/claude-code/super-dev/
├── agents/
│   └── super-dev.md                    # Main orchestrator
├── skills/
│   ├── proposal-builder/
│   │   └── SKILL.md                    # Interactive proposal generation
│   ├── feature-parser/
│   │   └── SKILL.md                    # Parse proposal → structured data
│   ├── codebase-analyzer/
│   │   └── SKILL.md                    # Find existing patterns
│   ├── judge-pragmatist/
│   │   └── SKILL.md                    # Judge: Pragmatist perspective
│   ├── judge-purist/
│   │   └── SKILL.md                    # Judge: Purist perspective
│   ├── judge-innovator/
│   │   └── SKILL.md                    # Judge: Innovator perspective
│   ├── judge-skeptic/
│   │   └── SKILL.md                    # Judge: Skeptic perspective
│   ├── judge-optimizer/
│   │   └── SKILL.md                    # Judge: Optimizer perspective
│   └── vote-aggregator/
│       └── SKILL.md                    # Aggregate votes → final decision
├── templates/
│   └── proposal-template.md            # Standard proposal format
└── README.md                           # Documentation
```

---

## Component Details

### 1. Proposal Builder (NEW - The "Super" Factor)

**Problem:** Users often give vague requests like "implement notifications on Laravel 12.x"

**Solution:** Interactive proposal generation

**Flow:**
1. Detect if request is incomplete (missing goals, requirements, constraints)
2. Ask contextual clarifying questions using AskUserQuestion tool
3. Research tech stack best practices via Context7 and codebase-analyzer
4. Auto-generate structured proposal
5. Show to user for confirmation
6. Proceed to judgement phase

**Question Strategy:**
- Questions are framework-aware (Laravel → Notification system patterns)
- One question at a time with multiple choice options
- Typically 3-5 questions to complete proposal

**Example Questions:**
- What triggers the notifications? (User actions / System events / Admin broadcasts)
- What delivery channels? (Email only / Database + email / Real-time WebSocket)
- User preference management? (No / Basic on/off / Granular per-type)
- Integration requirements? (Existing auth / Specific models / Third-party)
- Success criteria? (Just working / Specific metrics / Production-grade)

**Output:** Complete proposal in standard markdown format

---

### 2. Feature Parser

**Input:** Markdown proposal (user-written or auto-generated)

**Processing:**
- Extract feature title (H1 or first sentence)
- Parse Goals section (bullet list → goals array)
- Parse Requirements → must-have vs nice-to-have
- Parse Constraints (technical/business limitations)
- Parse Success Criteria (measurable outcomes)
- Extract keywords for codebase search

**Output:** ParsedProposal object
```typescript
interface ParsedProposal {
  title: string;
  goals: string[];
  requirements: {
    mustHave: string[];
    niceToHave: string[];
  };
  constraints: string[];
  successCriteria: string[];
  keywords: string[];
}
```

---

### 3. Codebase Analyzer

**Input:** ParsedProposal (keywords, requirements)

**Strategy:** Hybrid search (fast targeted → deep if needed)

**Phase 1 - Targeted Search:**
- Grep for keywords in file content
- Glob for related file patterns
- Identify similar existing features
- Detect tech stack (package.json, composer.json, etc)
- Find architecture patterns (MVC, services, repositories)

**Phase 2 - Deep Analysis (if <3 relevant files found):**
- Spawn Task agent with subagent_type=Explore
- Get comprehensive architecture understanding

**Output:** CodebaseContext object
```typescript
interface CodebaseContext {
  similarFeatures: Array<{
    path: string;
    purpose: string;
    relevance: "high" | "medium" | "low";
  }>;
  techStack: {
    languages: string[];
    frameworks: string[];
    libraries: string[];
  };
  patterns: {
    architecture: string;
    testingStrategy: string;
    conventions: string[];
  };
  potentialConflicts: string[];
  confidence: "High" | "Medium" | "Low";
}
```

---

### 4. Judge Personas (The Panel of 5)

All judges receive same input:
- ParsedProposal (what user wants)
- CodebaseContext (existing state)

All judges return same structure:
```typescript
interface JudgeVerdict {
  verdict: "APPROVE" | "REJECT";
  reasoning: string;
  keyConcerns: string[];
  suggestions: string[];
}
```

#### Judge 1: Pragmatist
**Philosophy:** "Ship it, then improve it"

**Focus:**
- Time to market
- Practical implementation
- User value
- Technical debt trade-offs

**Approves when:** Clear user value, achievable scope, reasonable timeline
**Rejects when:** Over-engineered, scope too large, unclear value

**Example:** "Can we build an MVP quickly using existing EmailService? Yes → APPROVE"

---

#### Judge 2: Purist
**Philosophy:** "Do it right, or don't do it at all"

**Focus:**
- Code quality
- Design patterns
- Maintainability
- Testing strategy
- Standards compliance

**Approves when:** Clean design, follows patterns, testable, maintainable
**Rejects when:** Violates principles, creates debt, poor architecture

**Example:** "Missing interface abstraction for notification channels → REJECT"

---

#### Judge 3: Innovator
**Philosophy:** "Let's find a better way"

**Focus:**
- Modern solutions
- Creative alternatives
- Technology opportunities
- User experience innovation
- Future-proofing

**Approves when:** Innovative approach, leverages modern solutions, good UX
**Rejects when:** Outdated approach when better alternatives exist

**Example:** "Use WebSocket instead of polling for true real-time → APPROVE with upgrade suggestion"

---

#### Judge 4: Skeptic
**Philosophy:** "What could go wrong?"

**Focus:**
- Risk identification
- Security concerns
- Scalability issues
- Compatibility problems
- Hidden complexity

**Approves when:** Risks are identified and mitigated
**Rejects when:** Critical risks unaddressed, too many unknowns

**Example:** "Missing permission model and rate limiting → REJECT (security risk)"

---

#### Judge 5: Optimizer
**Philosophy:** "Make it fast, make it efficient"

**Focus:**
- Performance (latency, throughput)
- Resource efficiency
- Database optimization
- Scalability
- Cost efficiency

**Approves when:** Performance acceptable, efficient implementation
**Rejects when:** Performance bottleneck, inefficient design

**Example:** "Need caching strategy and database indexes → APPROVE with conditions"

---

### 5. Vote Aggregator

**Input:** 5 JudgeVerdict objects

**Processing:**

**Step 1: Count Votes**
- Tally APPROVE vs REJECT
- Track which judges voted which way

**Step 2: Decision Matrix**
```
5 APPROVE           → APPROVED (unanimous)
4 APPROVE, 1 REJECT → APPROVED (strong consensus)
3 APPROVE, 2 REJECT → NEEDS_REVISION (split decision)
2 APPROVE, 3 REJECT → NEEDS_REVISION (major concerns)
0-1 APPROVE         → REJECTED (strong opposition)
```

**Step 3: Extract Themes**
- **Strengths:** Positive points mentioned by 2+ judges
- **Concerns:** Issues mentioned by 2+ judges
- **Critical:** Any concern from rejecting judges

**Step 4: Synthesize Recommendations**
- Group suggestions by theme (architecture, security, performance)
- Prioritize by consensus and severity
- Create actionable next steps

**Output:** FinalRecommendation with complete report

---

## Orchestrator Implementation (super-dev.md)

### Phase 0: Input Analysis
```markdown
if [has --file flag]:
    Load proposal from file
    → Proceed to parsing

elif [input is vague/incomplete]:
    Launch @skills/proposal-builder
    Get user confirmation
    → Proceed to parsing

else:
    Use inline input as proposal
    → Proceed to parsing
```

### Phase 1: Parse & Analyze
```markdown
Use @skills/feature-parser:
- Extract structured data from proposal
- Output: ParsedProposal

Use @skills/codebase-analyzer:
- Search for similar features
- Detect tech stack and patterns
- Output: CodebaseContext
```

### Phase 2: Launch 5 Judges in PARALLEL
```markdown
CRITICAL: Single message with 5 Task tool calls

Task 1: @skills/judge-pragmatist
Task 2: @skills/judge-purist
Task 3: @skills/judge-innovator
Task 4: @skills/judge-skeptic
Task 5: @skills/judge-optimizer

All receive: ParsedProposal + CodebaseContext
All return: JudgeVerdict
```

### Phase 3: Aggregate
```markdown
Use @skills/vote-aggregator:
- Input: 5 JudgeVerdict objects
- Process: count votes, extract themes, synthesize
- Output: FinalRecommendation
```

### Phase 4: Present Report
```markdown
Format as markdown with:
- Decision badge (APPROVED/NEEDS_REVISION/REJECTED)
- Vote breakdown
- Each judge's verdict summary
- Collapsible detailed analysis
- Must-fix items
- Recommended improvements
- Clear next steps
```

---

## Usage Examples

### Example 1: Vague Request

**User:**
```bash
/super-dev implement notification feature on laravel 12.x
```

**System:**
```
🧠 Request needs clarification. Let me ask a few questions...

Q1: What triggers the notifications?
[Multiple choice options]

Q2: What delivery channels do you need?
[Multiple choice options]

...

✅ Proposal generated! Does this capture what you need?
[Shows auto-generated proposal]
```

**User:** "Yes, run the review"

**System:**
```
✅ Proceeding to 5-judge review...
📝 Parsing proposal...
🔍 Analyzing codebase...
👥 Launching 5 judge agents in parallel...
⏳ All judges analyzing...
✅ All judges completed
📊 Aggregating verdicts...

[Presents final report with decision]
```

---

### Example 2: Structured Proposal

**User:**
```bash
/super-dev --file docs/proposals/notification-system.md
```

**System:**
```
📝 Parsing proposal from file...
✅ Parsed: "Real-time User Notifications"
🔍 Analyzing codebase...
✅ Found existing EmailService, Auth middleware
👥 Launching 5 judge agents in parallel...

[Proceeds directly to judgement, skips Q&A]
```

---

### Example 3: Result - NEEDS REVISION

**Final Report:**
```markdown
## 🎯 Feature Review: Real-time User Notifications

**Final Decision: ⚠️ NEEDS REVISION**
**Vote Breakdown:** 3 Approve, 2 Reject

### 📊 Judge Verdicts

✅ **Pragmatist:** APPROVE
> Good user value with realistic scope. Can leverage existing EmailService.

❌ **Purist:** REJECT
> Missing architectural clarity. Needs proper interface design.

✅ **Innovator:** APPROVE
> Great opportunity to modernize with WebSocket.

❌ **Skeptic:** REJECT
> Critical security gaps: no permission model, potential injection attacks.

✅ **Optimizer:** APPROVE with conditions
> Needs caching strategy and database indexes.

### 🔴 Must Address Before Implementation

1. **Define Permission Model** (Skeptic - CRITICAL)
   - Who can send notifications to whom?
   - Add NotificationPermission check

2. **Design Service Architecture** (Purist - CRITICAL)
   - Create INotificationChannel interface
   - Implement proper dependency injection

3. **Add Security Measures** (Skeptic - CRITICAL)
   - Sanitize notification content (prevent XSS)
   - Rate limiting: max 10/minute per user

4. **Optimization Strategy** (Optimizer - HIGH)
   - Cache user preferences in Redis
   - Add database indexes

### Next Steps

⚠️ Revise proposal and resubmit:
1. Update with architecture section (interface design)
2. Add security section (permission model + sanitization)
3. Add performance section (caching + indexes)

Once revised: `/super-dev --file proposal-v2.md`
```

---

## Proposal Template

**File:** `templates/proposal-template.md`

```markdown
# Feature: [Feature Name]

## Overview
Brief description of what this feature does and why it's needed.

## Goals
What we're trying to achieve:
- Goal 1
- Goal 2
- Goal 3

## Requirements

### Must Have
Critical features that must be implemented:
- [ ] Requirement 1
- [ ] Requirement 2

### Nice to Have
Optional features:
- [ ] Optional feature 1
- [ ] Optional feature 2

## Constraints
Technical or business limitations:
- Constraint 1 (e.g., "Must use existing auth system")
- Constraint 2 (e.g., "Cannot break backward compatibility")

## Success Criteria
How we measure success:
- [ ] Criterion 1 (e.g., "95% delivery rate")
- [ ] Criterion 2 (e.g., "Response time < 100ms")

## Related Context
(Optional) Links to existing issues, docs, or similar features:
- Related issue: #123
- Similar feature: src/alerts/
```

---

## Technical Details

### Performance Expectations

```
Phase 0: Proposal Builder (if needed)
- Q&A interaction: 1-3 minutes (user response time)
- Auto-generation: 10-20 seconds
- Total: 1-3 minutes

Phase 1: Parse & Analyze
- feature-parser: ~10 seconds
- codebase-analyzer: 30 seconds - 2 minutes
- Total: 40 seconds - 2 minutes

Phase 2: Parallel Judgement
- All 5 judges run simultaneously
- Each judge: 1-3 minutes
- Total: 1-3 minutes (NOT 5-15 because parallel!)

Phase 3: Aggregation & Report
- vote-aggregator: ~20 seconds
- Format output: ~10 seconds
- Total: 30 seconds

Overall: 2-6 minutes (excluding user Q&A time)
```

### Error Handling

**Parser Fails:**
- Show error, suggest using template
- Continue with partial data if possible

**Analyzer Finds Nothing:**
- Continue with "low confidence" flag
- Judges will note lack of context

**1-2 Judges Fail:**
- Continue with remaining judges
- Adjust decision matrix (3/4 approve = APPROVED)
- Note missing judge in report

**3+ Judges Fail:**
- Abort with error
- Ask user to retry
- Log for debugging

**Proposal File Not Found:**
- Clear error with example usage
- Suggest checking file path

---

## YAGNI - What We're NOT Building

To keep MVP focused and avoid over-engineering:

❌ **Not Included:**
- GitHub integration (auto-commenting)
- Multi-proposal comparison
- Historical decision tracking
- ML-based improvements
- Custom judge personas (fixed 5 only)
- Judge vote weighting (all equal)
- Proposal versioning system
- Auto-implementation after approval
- Cost/timeline estimation
- Real-time collaboration
- Proposal diff viewer

✅ **Focus:** One proposal in, one report out.

---

## Success Criteria

**Must Have:**
- [ ] Transform vague requests into structured proposals
- [ ] 5 judges execute in parallel (single message)
- [ ] Clear APPROVED/NEEDS_REVISION/REJECTED decision
- [ ] Actionable feedback with specific next steps
- [ ] Complete execution in <6 minutes
- [ ] Handle both inline and file-based proposals

**Nice to Have:**
- [ ] Proposal template generation helper
- [ ] Judge persona customization (future)
- [ ] Integration with planning tools (future)

---

## Next Steps

1. ✅ Design approved
2. **Implementation:**
   - Create super-dev directory structure
   - Implement proposal-builder skill (interactive Q&A)
   - Implement feature-parser skill
   - Implement codebase-analyzer skill
   - Implement 5 judge skills (with distinct personas)
   - Implement vote-aggregator skill
   - Implement main orchestrator (super-dev.md)
   - Create proposal template
   - Write README documentation
3. **Testing:**
   - Test with vague requests (Laravel notification)
   - Test with structured proposals
   - Test parallel judge execution
   - Test all decision outcomes (APPROVED/NEEDS_REVISION/REJECTED)
4. **Documentation:**
   - User guide with examples
   - Judge persona reference
   - Troubleshooting guide

---

## Appendix: Key Design Decisions

**Q: Why 5 judges instead of 3 or 7?**
A: 5 provides diverse perspectives without overwhelming consensus. Odd number prevents ties. Each represents distinct philosophy.

**Q: Why parallel instead of sequential?**
A: Independent judgements prevent bias. Faster execution (1-3 min vs 5-15 min). More realistic "panel review" simulation.

**Q: Why proposal-builder instead of requiring structured input?**
A: Makes system accessible to all users. "Super-dev" name implies it handles complexity. Better UX for quick requests.

**Q: Why approve/reject instead of scoring?**
A: Simpler to understand. Forces clear decision. Avoids analysis paralysis. Scoring can hide in "maybe" zone.

**Q: Why fixed personas instead of customizable?**
A: YAGNI - start simple. 5 cover most concerns. Customization adds complexity without proven value yet.

---

**Design Status:** ✅ APPROVED - Ready for Implementation
**Estimated Implementation Time:** 4-6 hours
**Created:** 2026-01-26
