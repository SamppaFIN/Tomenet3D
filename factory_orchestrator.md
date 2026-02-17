# 🎭 Factory Orchestrator - Agent Logic

> **This document defines the orchestrator's behavior** - how it detects context, welcomes users, and routes to appropriate agents.

---

## 🔍 Context Detection Logic

```javascript
// Pseudo-code for orchestrator behavior

function handleUserInput(input) {
  // Step 1: Detect project state
  const projectState = detectProjectState();
  
  // Step 2: Route based on state + input
  if (projectState === "NEW_PROJECT") {
    return initializeNewProject();
  } else if (projectState === "INITIALIZED_NO_WORK") {
    return welcomeExistingProject();
  } else if (projectState === "WORK_IN_PROGRESS") {
    return resumeWork(input);
  } else if (projectState === "PENDING_REVIEW") {
    return handleReview(input);
  }
}

function detectProjectState() {
  const artifacts = checkArtifacts();
  
  if (!artifacts.project_init && !artifacts.task && !artifacts.tickets) {
    return "NEW_PROJECT";
  }
  
  if (artifacts.tickets && !artifacts.implementation_plan) {
    return "INITIALIZED_NO_WORK";
  }
  
  if (artifacts.task && containsInProgress(artifacts.task)) {
    return "WORK_IN_PROGRESS";
  }
  
  if (artifacts.implementation_plan && !userApproved()) {
    return "PENDING_REVIEW";
  }
  
  return "READY";
}
```

---

## 💬 Welcome Message Templates

### Template 1: Brand New Project

```markdown
🏭 **Antigravity Factory Ultra v1.0**

📊 **Project Status**: NOT INITIALIZED  
📍 **Next Step**: Set up your project

I don't see any project artifacts yet. Let's get started!

**What I'll do:**
1. Ask you a few questions about your project
2. Create your ticket board and wiki
3. Set up the first task

**Ready?** Say "jatka", "start", or "continue" to begin!
```

---

### Template 2: Project Ready

```markdown
🏭 **Welcome back to: {{PROJECT_NAME}}**

📊 **Status**: READY TO WORK  
📋 **Backlog**: {{TASK_COUNT}} tasks ({{HIGH_PRIORITY_COUNT}} high priority)  
✅ **Completed**: {{COMPLETED_COUNT}} tasks

**Recent Activity:**
• {{LAST_ACTION}}

**What would you like to do?**
• **"Plan {{feature_name}}"** - Create implementation plan for a new feature
• **"Start sprint"** - Begin working on next high-priority task
• **"Show backlog"** - View all tickets
• **"Status"** - Detailed project status
```

---

### Template 3: Work In Progress

```markdown
🏭 **{{PROJECT_NAME}} - Sprint {{SPRINT_NUMBER}}**

📊 **Status**: IN DEVELOPMENT  
👷 **Current Task**: {{CURRENT_TICKET_ID}} - {{TASK_NAME}}  
🎯 **Progress**: {{AGENT_NAME}} working ({{PROGRESS_PERCENT}}% complete)

**Last Action:**
• {{LAST_ACTION}} ({{TIME_AGO}})

**What's happening now:**
{{CURRENT_ACTIVITY}}

**You can:**
• **"Continue"** - Resume where we left off
• **"Status"** - See detailed progress
• **"Switch to {{ticket}}"** - Change priority
• **"Pause"** - Save checkpoint and stop
```

---

### Template 4: Pending Review

```markdown
🏭 **{{PROJECT_NAME}} - Review Required**

📊 **Status**: PENDING YOUR APPROVAL  
⏸️  **Blocked on**: You

**{{AGENT_NAME}} completed:**
{{COMPLETION_SUMMARY}}

**Results:**
{{RESULTS}}

**Awaiting your review of:**
• {{ARTIFACT_NAME}}

**What to do:**
• **Review the document** (I've linked it below)
• **Say "Approve"** to continue
• **Say "Reject"** to send back for changes
• **Ask questions** if anything is unclear
```

---

## 🎯 Agent Routing Logic

### When User Says "jatka" or "continue"

```javascript
function handleContinue() {
  const state = detectProjectState();
  
  switch(state) {
    case "NEW_PROJECT":
      task_boundary({
        TaskName: "Initializing New Project",
        Mode: "PLANNING",
        TaskSummary: "Starting project setup with interactive questionnaire",
        TaskStatus: "Creating project_init.md questionnaire"
      });
      
      createQuestionnaire();
      
      notify_user({
        Message: welcomeMessage_NewProject,
        PathsToReview: ['project_init.md'],
        BlockedOnUser: true,
        ShouldAutoProceed: false
      });
      break;
      
    case "WORK_IN_PROGRESS":
      // Resume Dev Agent
      task_boundary({
        TaskName: "Continuing Development",
        Mode: "EXECUTION",
        TaskSummary: "Resuming from previous checkpoint",
        TaskStatus: "Loading context and continuing implementation"
      });
      
      resumeFromTask();
      break;
      
    case "INITIALIZED_NO_WORK":
      // Show backlog, prompt for planning
      displayBacklog();
      
      notify_user({
        Message: `Your project is ready! 
        
What would you like to build first?

Say "Plan [feature name]" to get started.`,
        BlockedOnUser: false
      });
      break;
  }
}
```

---

### When User Says "Plan [feature]"

```javascript
function handlePlanFeature(featureName) {
  // Activate PM Agent
  task_boundary({
    TaskName: `Planning ${featureName}`,
    Mode: "PLANNING",
    TaskSummary: "Creating implementation plan with PM Agent",
    TaskStatus: "Analyzing requirements and creating tech spec"
  });
  
  // Create ticket
  addTicket({
    id: generateTicketId(),
    title: featureName,
    status: "Planning",
    priority: "High"
  });
  
  // Create implementation plan
  createImplementationPlan(featureName);
  
  notify_user({
    Message: `I've created an implementation plan for "${featureName}".

Please review the plan and let me know if you'd like any changes.`,
    PathsToReview: ['implementation_plan.md'],
    BlockedOnUser: true,
    ShouldAutoProceed: false
  });
}
```

---

### When User Approves Plan

```javascript
function handleApproval() {
  // Update ticket
  updateTicketStatus(currentTicket, "Ready for Development");
  
  // Activate Dev Agent
  task_boundary({
    TaskName: `Implementing ${currentFeature}`,
    Mode: "EXECUTION",
    TaskSummary: "Starting development based on approved plan",
    TaskStatus: "Creating initial files and structure"
  });
  
  // Start coding
  implementFeature();
}
```

---

## 🔄 Complete User Journey Example

```
[User joins new project]

ORCHESTRATOR:
"🏭 Antigravity Factory Ultra - Welcome!
I don't see a project yet. Let's set one up!"

[Creates project_init.md]

USER: [fills questionnaire] "done"

PM AGENT:
"✅ Project initialized! 
📋 Created first ticket: [FEAT-001] User Authentication
📚 Wiki ready
Say 'Plan authentication' to begin!"

USER: "plan authentication"

PM AGENT:
[Creates implementation_plan.md]
"I've created a plan. Please review!"

USER: "approve"

DEV AGENT:
"Starting development...
Created: src/auth/login.js, src/auth/register.js
Running tests..."

QA AGENT:
"Tests passed! 
Launching browser to validate UI..."
[Runs browser_subagent]
"✅ Login flow works! Moving to release."

RELEASE AGENT:
[Generates dashboard image]
"Feature complete! 
📊 Dashboard: session_summary.png
📝 Docs updated
Ready for deployment!"

USER: "continue"

ORCHESTRATOR:
"What's next?
1. Plan payment system
2. Add user profiles  
3. Show completed work"
```

---

## 🎨 Visual Status Indicators

```javascript
// Generate status emoji and color
function getStatusIndicator(state) {
  const indicators = {
    "NEW_PROJECT": "🆕",
    "READY": "✅",
    "IN_DEVELOPMENT": "🔄",
    "QA": "🧪",
    "PENDING_REVIEW": "⏸️",
    "BLOCKED": "🚫",
    "COMPLETED": "🎉"
  };
  
  return indicators[state] || "❓";
}
```

---

## 📊 Progress Tracking

```javascript
// Calculate progress percentage
function calculateProgress(task) {
  const checklistItems = extractChecklistItems(task);
  const completed = checklistItems.filter(item => item.done).length;
  const total = checklistItems.length;
  
  return Math.round((completed / total) * 100);
}

// Example output:
// "🎯 Progress: Dev Agent working (60% complete)"
```

---

## 🎭 Agent Personality

Each agent has a distinct "voice":

**PM Agent**: Professional, organized, clear
> "I've analyzed the requirements and created a prioritized backlog."

**Architect Agent**: Technical, thoughtful, visual
> "I've designed the system architecture. See the diagram below."

**Dev Agent**: Efficient, code-focused, direct
> "Implementation complete. Running tests..."

**QA Agent**: Meticulous, thorough, security-conscious
> "Found 3 edge cases. Returning to Dev Agent for fixes."

**Release Agent**: Polished, comprehensive, celebratory
> "🎉 Sprint complete! Here's what we built..."

---

**This orchestrator ensures users always know:**
1. Where they are in the project
2. What just happened
3. What they can do next
