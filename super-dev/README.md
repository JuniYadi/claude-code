# Super-Dev: Multi-Agent Feature Planning

**Multi-perspective feature evaluation system with 5 independent judge agents.**

## Overview

Super-Dev transforms vague feature ideas into structured proposals, then evaluates them through 5 independent AI agents - each with a unique perspective - to produce actionable go/no-go decisions before implementation.

### The 5 Judges

- **🚀 Pragmatist** - "Ship it, then improve it" - Focuses on practical execution and user value
- **✨ Purist** - "Do it right, or don't do it at all" - Ensures code quality and architectural integrity
- **💡 Innovator** - "Let's find a better way" - Pushes for modern solutions and creative approaches
- **🛡️ Skeptic** - "What could go wrong?" - Identifies risks, security issues, and edge cases
- **⚡ Optimizer** - "Make it fast, make it efficient" - Ensures performance and scalability

## Why Use Super-Dev?

**Prevents Costly Mistakes:**
- Catches security vulnerabilities before implementation
- Identifies performance bottlenecks upfront
- Prevents architectural debt
- Finds edge cases you haven't considered

**Speeds Up Planning:**
- Turns vague ideas into structured proposals in minutes
- Gets multi-perspective feedback instantly
- Provides actionable next steps
- Reduces back-and-forth discussions

**Improves Quality:**
- Ensures features fit existing architecture
- Validates technical approach before coding
- Balances speed vs quality trade-offs
- Considers user experience, security, and performance together

## Quick Start

### Basic Usage

```bash
# Vague request (system will ask clarifying questions)
/super-dev add user notifications to my app

# With structured proposal file
/super-dev --file docs/proposals/notification-system.md
```

### Example Session

```
$ /super-dev add notification feature to Laravel 12

🧠 Analyzing request...
⚠️  Request needs clarification. Let me ask a few questions...

Q1: What triggers the notifications?
[ ] User actions (mentions, messages)
[ ] System events (reminders, alerts)
[✓] Both

[Answers 4 more questions...]

✅ Proposal generated!

📝 Parsing & analyzing codebase...
✅ Found existing EmailService, can reuse!

👥 Launching 5 judge agents in parallel...
✅ All judges completed

📊 Final Decision: ⚠️ NEEDS REVISION
Vote: 3 Approve, 2 Reject

Must Address:
1. Add INotificationChannel interface (Purist)
2. Implement rate limiting (Skeptic)
3. Add caching strategy (Optimizer)

Next: Revise proposal addressing these concerns
```

## How It Works

### 1. Intelligent Proposal Building

**Input:** "add notifications to Laravel app"

**System:**
- Detects framework (Laravel)
- Asks 5-7 contextual questions
- Researches Laravel best practices
- Generates structured proposal
- Gets your confirmation

**Output:** Complete proposal with goals, requirements, constraints, success criteria

### 2. Parallel Multi-Agent Review

5 judges evaluate simultaneously (not sequentially - saves time!):

| Judge | Evaluates | Approves If | Rejects If |
|-------|-----------|-------------|------------|
| **Pragmatist** | Feasibility, user value | Clear MVP, realistic scope | Over-engineered, vague value |
| **Purist** | Architecture, code quality | Clean design, proper patterns | Tight coupling, technical debt |
| **Innovator** | Modern tech, creative UX | Uses current best practices | Outdated approach available |
| **Skeptic** | Security, risks, edge cases | Risks mitigated | Critical vulnerabilities |
| **Optimizer** | Performance, efficiency | Scales well, caching planned | N+1 queries, bottlenecks |

### 3. Vote Aggregation & Decision

**Decision Matrix:**
- 5 or 4 APPROVE → ✅ **APPROVED** (ready to implement)
- 3 APPROVE → ⚠️ **NEEDS REVISION** (fix specific issues and resubmit)
- 0-2 APPROVE → ❌ **REJECTED** (fundamental redesign needed)

**Report Includes:**
- Each judge's verdict and reasoning
- Common themes (strengths & concerns)
- Must-fix items (prioritized)
- Recommended improvements
- Clear next steps

## File Structure

```
super-dev/
├── agents/
│   └── super-dev.md              # Main orchestrator (entry point)
├── skills/
│   ├── proposal-builder/         # Interactive proposal generation
│   ├── feature-parser/           # Parse markdown → structured data
│   ├── codebase-analyzer/        # Understand existing code patterns
│   ├── judge-pragmatist/         # Judge: Practical execution
│   ├── judge-purist/             # Judge: Code quality
│   ├── judge-innovator/          # Judge: Modern solutions
│   ├── judge-skeptic/            # Judge: Risk analysis
│   ├── judge-optimizer/          # Judge: Performance
│   └── vote-aggregator/          # Combine verdicts → final decision
├── templates/
│   └── proposal-template.md      # Proposal format template
└── README.md                     # This file
```

## Proposal Template

Create structured proposals manually using this format:

```markdown
# Feature: [Feature Name]

## Overview
Brief description of what and why.

## Goals
- Goal 1
- Goal 2

## Requirements

### Must Have
- [ ] Requirement 1
- [ ] Requirement 2

### Nice to Have
- [ ] Optional feature 1

## Constraints
- Constraint 1 (e.g., "Must use Laravel Notifications")

## Success Criteria
- [ ] Criterion 1 (e.g., "95% delivery rate")

## Related Context
- Existing code: app/Services/EmailService.php
```

See full template: [`templates/proposal-template.md`](templates/proposal-template.md)

## Example Scenarios

### Scenario 1: Security Issue Caught

**Proposal:** User notification system

**Skeptic Rejects:**
> No permission model. Any user can spam notifications to any user. No rate limiting allows DoS attacks.

**Outcome:** Added permission service and rate limiting before implementation. **Prevented production security incident.**

---

### Scenario 2: Performance Optimized

**Proposal:** Display notifications with user details

**Optimizer Rejects:**
> N+1 query problem. 50 notifications = 51 database queries. Will cripple performance at scale.

**Outcome:** Implemented eager loading. **50x reduction in database load.**

---

### Scenario 3: Scope Reduced for Faster Shipping

**Proposal:** Complete notification system with 4 delivery channels

**Pragmatist Suggests:**
> Start with email only (MVP), validate value, then add channels iteratively.

**Outcome:** Shipped v1 in 2 weeks instead of 2 months. **Faster time-to-market.**

---

### Scenario 4: Better Architecture Proposed

**Purist Rejects:**
> No interface abstraction. Adding new notification types requires modifying core logic.

**Outcome:** Defined INotificationChannel interface. **Adding new channels now takes 10 minutes, not days.**

---

## Tips for Success

### For Best Results

**DO:**
- ✅ Be honest in Q&A (garbage in = garbage out)
- ✅ Read ALL judge feedback, not just the decision
- ✅ Take revision seriously - judges catch real issues
- ✅ Use for major features (where mistakes are costly)

**DON'T:**
- ❌ Ignore minority opinions (1 reject in 4 approves often highlights real risk)
- ❌ Rush revisions (address concerns properly)
- ❌ Use for trivial changes (overkill for minor tweaks)
- ❌ Treat as rubber stamp (it's a critical review)

### When to Use Super-Dev

**Use for:**
- New major features
- Architecture changes
- Security-critical features
- Performance-sensitive features
- Features affecting many users
- Before starting multi-week implementations

**Skip for:**
- Bug fixes
- Trivial UI tweaks
- Copy changes
- Configuration updates
- One-line changes

## Interpreting Results

### ✅ APPROVED (4-5 Approves)

**Meaning:** Feature is well-designed and ready to implement.

**Next Steps:**
1. Address recommended improvements during development
2. Follow architecture guidelines from Purist
3. Implement security suggestions from Skeptic
4. Use performance optimizations from Optimizer
5. Start with MVP scope if Pragmatist suggested

### ⚠️ NEEDS REVISION (3 Approves, 2 Rejects)

**Meaning:** Good foundation but specific issues must be addressed.

**Next Steps:**
1. Fix all "Must Address" items from rejecting judges
2. Update proposal with solutions
3. Re-run super-dev with revised proposal
4. Expected: APPROVED after addressing concerns

**Typical fixes take 1-3 hours of planning.**

### ❌ REJECTED (0-2 Approves)

**Meaning:** Fundamental issues require redesign.

**Next Steps:**
1. Review all judge concerns carefully
2. Consider alternative approaches suggested
3. Possibly break into smaller proposals
4. Consult with team before resubmitting
5. May need to validate assumptions first

**Don't force through - judges likely identified real problems.**

## Advanced Usage

### Iterative Refinement

```bash
# First attempt
$ /super-dev --file proposal-v1.md
→ NEEDS REVISION: Add caching, fix architecture

# Revise proposal
$ vim proposal-v2.md  # Address concerns

# Resubmit
$ /super-dev --file proposal-v2.md
→ APPROVED: Ready to implement!
```

### Phased Proposals

For large features, submit phases separately:

```bash
$ /super-dev --file notification-phase1-email.md
→ APPROVED

[Implement Phase 1]

$ /super-dev --file notification-phase2-websocket.md
→ APPROVED

[Implement Phase 2]
```

Each phase gets thorough review, reduces risk.

## FAQ

**Q: How long does a review take?**
A: 2-6 minutes typically (excluding user Q&A time for vague requests).

**Q: Can I customize the judges?**
A: Currently no - the 5 judge personas are fixed. Future versions may allow customization.

**Q: What if judges disagree?**
A: That's the point! Different perspectives catch different issues. Vote aggregation balances their views.

**Q: Will this slow down development?**
A: No - it speeds up development by catching issues before coding starts. 5 minutes of planning saves hours of rework.

**Q: Can I skip judges I don't care about?**
A: No - all 5 run in parallel. Each judge's perspective is valuable for different reasons.

**Q: What if I disagree with a judge?**
A: Judges are advisory, not mandatory. But consider: they often catch real issues you might have missed.

**Q: Does this work for all tech stacks?**
A: Yes - judges adapt to your codebase. Framework-specific best practices are researched automatically.

## Troubleshooting

**"File not found" error:**
```bash
# Check file path
$ ls docs/proposals/my-proposal.md

# Use absolute path if relative fails
$ /super-dev --file /full/path/to/proposal.md
```

**"Multi-agent review failed":**
- Wait a moment and retry
- Check network connectivity
- If persists, check system resources

**Proposal builder asks weird questions:**
- Provide more context in initial request
- Example: "add notifications" → "add email notifications for user mentions to Laravel app"

**Judges seem biased:**
- Each judge has a specific role - that's intentional
- Balance comes from aggregation, not individual judges
- Read the aggregated report, not just individual verdicts

## Contributing

Found issues or have suggestions? Open an issue or PR!

Areas for improvement:
- Additional judge personas
- Customizable decision thresholds
- Integration with GitHub issues
- Historical tracking of decisions
- A/B testing different approaches

## License

[Your License Here]

## Credits

Built on Claude AI multi-agent orchestration capabilities.

Inspired by real-world code review processes where multiple reviewers with different expertise provide diverse feedback.

---

**Version:** 1.0.0
**Last Updated:** 2026-01-26
