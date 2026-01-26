# Proposal Builder

Transform vague feature requests into structured proposals through interactive Q&A.

## Purpose

When users provide simple requests like "implement notifications on Laravel 12.x" or "add user authentication", this skill guides them through clarifying questions to generate a complete, structured proposal ready for judgement.

## Input

Raw user request (string) - can be as vague as:
- "add notifications"
- "implement auth on Laravel"
- "make the app faster"

## Process

### Step 1: Analyze Request Completeness

Check if the request contains:
- Feature description (what)
- Goals/objectives (why)
- Requirements (specific needs)
- Constraints (limitations)
- Success criteria (how to measure)

If missing 2+ critical sections → Launch interactive builder

### Step 2: Detect Feature Type & Framework

Extract from request:
- **Feature type**: auth, notifications, payment, search, API, UI, performance, etc.
- **Framework/tech stack**: Laravel, React, Vue, Django, Express, etc.
- **Keywords**: for codebase search later

### Step 3: Ask Contextual Clarifying Questions

Use AskUserQuestion tool to gather missing information.

**Question Strategy:**
- One question at a time
- Multiple choice options (easier than open-ended)
- 3-5 questions typically sufficient
- Questions adapt based on feature type and framework

**Common Question Templates:**

**For ANY feature:**
```
Q: What's the main goal of this feature?
Options:
- Solve specific user pain point (describe in "Other")
- Business requirement
- Technical improvement
- Competitive parity

Q: What are the key requirements?
Options:
- Just basic functionality
- Production-ready with error handling
- Enterprise-grade with monitoring
- MVP to validate concept

Q: Any technical constraints?
Options:
- Must use existing [detected framework] patterns
- Cannot break backward compatibility
- Must integrate with [detected systems]
- No constraints

Q: How will you measure success?
Options:
- Just working is enough
- Specific metrics (define in "Other")
- User feedback/adoption
- Performance benchmarks
```

**For Notifications (example):**
```
Q1: What triggers the notifications?
Options:
- User actions (mentions, messages, follows)
- System events (reminders, alerts, updates)
- Admin broadcasts
- Multiple types

Q2: What delivery channels do you need?
Options:
- Email only (simple start)
- Database + email (recommended for [framework])
- Real-time (WebSocket/Pusher)
- Push notifications (mobile/browser)

Q3: Do users need to manage notification preferences?
Options:
- No, send all notifications
- Yes, basic on/off toggle
- Yes, granular per-notification-type preferences
- Yes, advanced (frequency, channels, etc)

Q4: Integration requirements?
Options:
- Use existing user/auth system
- Integrate with specific models (describe in "Other")
- Third-party services (SendGrid, Pusher, etc)
- Standalone system

Q5: Any performance/scale requirements?
Options:
- Small scale (<1000 users)
- Medium scale (<100k users)
- Large scale (100k+ users)
- Real-time delivery critical
```

**For Authentication (example):**
```
Q1: What auth method?
Options:
- Email + password (classic)
- Social login (Google, GitHub, etc)
- Magic link (passwordless)
- Multi-factor authentication
- Multiple methods

Q2: Session management?
Options:
- Standard sessions ([framework] default)
- JWT tokens (for APIs/SPAs)
- OAuth 2.0
- Remember me functionality

Q3: Authorization needs?
Options:
- No roles, all users equal
- Simple roles (admin, user)
- Complex permissions (role-based access control)
- Resource-based permissions

Q4: Security requirements?
Options:
- Basic (password hashing)
- Standard (+ rate limiting, CSRF)
- Enhanced (+ 2FA, audit logs)
- Enterprise (+ SSO, compliance)
```

**For Performance (example):**
```
Q1: What's slow?
Options:
- Page load time
- Database queries
- API response time
- Background jobs
- All of the above

Q2: Current vs target performance?
Options:
- Current: >2s, Target: <1s
- Current: >5s, Target: <2s
- Not measured yet, just "feels slow"
- Specific metrics (describe in "Other")

Q3: Optimization scope?
Options:
- Quick wins only (caching, indexes)
- Moderate (query optimization, lazy loading)
- Deep (architecture changes, caching layers)
- Complete overhaul

Q4: Constraints?
Options:
- Cannot change database schema
- Cannot add infrastructure (Redis, CDN)
- Must maintain backward compatibility
- No constraints
```

### Step 4: Research Framework Best Practices

If framework detected (Laravel, React, etc), use Context7 to fetch relevant docs:

```markdown
Use mcp__plugin_context7_context7__resolve-library-id to find library
Use mcp__plugin_context7_context7__query-docs to get best practices

For Laravel notifications:
- Query: "Laravel notification system implementation best practices"
- Extract: recommended patterns, channels, queue setup

For React auth:
- Query: "React authentication implementation with hooks"
- Extract: context patterns, protected routes, token storage

For general patterns:
- Query: "[Feature type] implementation patterns [framework]"
```

### Step 5: Analyze Existing Codebase

Quick scan to understand current state:

```markdown
Use codebase-analyzer (if available) OR quick search:
- Glob for framework config files (composer.json, package.json)
- Grep for similar feature keywords
- Identify existing patterns (services, models, etc)

Extract:
- Tech stack confirmation
- Existing similar features
- Architecture patterns to follow
```

### Step 6: Generate Structured Proposal

Combine user answers + framework best practices + codebase context:

```markdown
# Feature: [Inferred from user request + clarifications]

## Overview
[Generated from: user request + main goal answer]

Example:
"Add notification system to alert users about mentions, messages, and
system updates. Uses Laravel's built-in Notification system with database
and email channels for reliable delivery."

## Goals
[Extracted from Q&A, typically 2-4 goals]

Example:
- Notify users of important events in real-time
- Support multiple delivery channels for flexibility
- Integrate seamlessly with existing user system
- Provide user control over notification preferences

## Requirements

### Must Have
[From user answers + framework requirements]

Example for Laravel notifications:
- [ ] Create Notification classes for each event type
- [ ] Database notification channel for in-app display
- [ ] Email notification channel with queue support
- [ ] Integration with User model and existing auth
- [ ] Mark as read/unread functionality
- [ ] Notification preferences table and UI

### Nice to Have
[Optional features mentioned or suggested]

Example:
- [ ] Real-time delivery via WebSocket/Pusher
- [ ] Browser push notifications
- [ ] Notification grouping/digest mode
- [ ] Admin notification broadcast feature

## Constraints
[Detected from codebase + user answers]

Example:
- Must use Laravel 12.x Notification system (framework constraint)
- Follow existing queue configuration (Redis-based)
- Compatible with current mail driver (SMTP/Mailgun)
- Cannot modify User table structure (must use relationship)
- Must maintain <100ms overhead per request

## Success Criteria
[From user answers or intelligent defaults]

Example:
- [ ] 95%+ notification delivery rate
- [ ] Email delivery within 30 seconds (queue processing)
- [ ] In-app notifications appear immediately on next page load
- [ ] User preference changes apply instantly
- [ ] Zero disruption to existing auth/user flows

## Related Context
[Auto-detected from codebase scan]

Example:
- Existing User model: app/Models/User.php
- Mail config: config/mail.php
- Queue setup: config/queue.php (Redis driver)
- Similar feature: app/Notifications/WelcomeEmail.php (reference implementation)
```

### Step 7: Present to User for Confirmation

```markdown
Show generated proposal with:

"✅ I've generated a proposal based on your requirements:

[Display full proposal in collapsible section]

<details>
<summary>📋 View Generated Proposal</summary>

[Proposal content here]

</details>

Does this capture what you need?"

Use AskUserQuestion:
- ✅ Yes, proceed with review (Recommended)
- ✏️ Let me edit it first (save to file)
- 🔄 Ask me different questions (restart)
- ❌ This is not what I want (abort)
```

**If "Yes, proceed":**
- Return proposal for parsing
- Continue to Phase 1 (feature-parser)

**If "Let me edit":**
- Write to file: `docs/proposals/[feature-name]-proposal.md`
- Tell user: "Saved to [path]. Edit and run: /super-dev --file [path]"
- Exit

**If "Ask different questions":**
- Reset and try alternative question set
- Maybe ask open-ended instead of multiple choice

**If "Not what I want":**
- Ask for clarification on what's wrong
- Offer to start over with better context

## Output

```typescript
interface GeneratedProposal {
  content: string;  // Full markdown proposal
  approved: boolean;  // User confirmed
  filePath?: string;  // If saved to file
}
```

## Example Execution

**Input:** "implement notification feature on laravel 12.x"

**Detected:**
- Feature type: notifications
- Framework: Laravel 12.x
- Vague: YES (missing goals, requirements, constraints)

**Questions Asked:**
1. Triggers? → User actions (mentions, messages)
2. Channels? → Database + email
3. Preferences? → Yes, basic on/off toggle
4. Integration? → Existing User model
5. Scale? → Medium (<100k users)

**Framework Research:**
- Laravel Notification docs fetched
- Best practices: use queues, database channel, notification preferences pattern

**Codebase Scan:**
- Found: composer.json (Laravel 12.2)
- Found: app/Models/User.php
- Found: config/queue.php (Redis driver)
- Found: app/Notifications/WelcomeEmail.php (existing notification example)

**Generated Proposal:**
[Complete structured proposal as shown in Step 6 example]

**User Confirms:** ✅ Yes, proceed

**Returns:** Proposal content ready for feature-parser

---

## Tips

**Keep questions short and focused:**
- Bad: "What are your requirements for the notification system including channels, preferences, integrations, and performance needs?"
- Good: "What delivery channels do you need?" (one thing at a time)

**Provide context in options:**
- Bad: "Email / Database / WebSocket"
- Good: "Email only (simple start) / Database + email (recommended for Laravel) / Real-time (WebSocket)"

**Use framework knowledge:**
- For Laravel: suggest Notification classes, queues, database channel
- For React: suggest Context API, custom hooks, protected routes
- For Django: suggest authentication backends, middleware, permissions

**Adapt to user expertise:**
- If user mentions "Notification class" → they know Laravel, ask advanced questions
- If user says "send emails somehow" → beginner-friendly options

**Intelligent defaults:**
- If user unsure about success criteria → suggest framework-appropriate defaults
- If user unsure about scale → assume medium scale
- If user unsure about security → suggest standard best practices

---

## Error Handling

**No framework detected:**
- Ask explicitly: "What framework/stack are you using?"
- If none: generate generic proposal without framework-specific details

**User gives conflicting answers:**
- Clarify: "You mentioned X but also Y. Which should I prioritize?"
- Use most recent answer as source of truth

**User requests feature that's already implemented:**
- Codebase scan finds existing feature
- Inform user: "Found existing implementation at [path]. Do you want to enhance it or build separately?"

**Cannot fetch framework docs (Context7 fails):**
- Continue with general best practices
- Note in proposal: "Framework-specific research unavailable, review for [framework] patterns"

**User aborts after questions:**
- Save progress if possible
- Suggest: "If you have more clarity later, try again or start with proposal template"
