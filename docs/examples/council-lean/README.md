# Lean Council - Efficient Development Focus

This is the **production-ready lean council** optimized for everyday development efficiency. Perfect for rapid development while maintaining quality standards.

## Philosophy: Smart Verification, Less Bureaucracy

The lean council strikes the perfect balance between:
❌ **Too lax** - "Just trust me, it's done"  
❌ **Too bureaucratic** - "Show me every single line of code"  
✅ **Smart verification** - "Show me the right evidence to be confident"

## Council Members (2 Active for Auto-Mode)

### Auto Members (For Automated Sessions)
- **coach_auto.txt** - Primary quality gate and spec compliance
- **simplicity_advocate_auto.txt** - Complexity prevention and clean code

### Regular Members (For Manual Sessions)  
- **coach.txt** - Implementation guidance and collaboration
- **code_reviewer.txt** - Code quality review
- **spec_validator.txt** - Specification compliance
- **simplicity_advocate.txt** - Simplicity and complexity review
- **security_expert.txt** - Security analysis
- **ux_designer.txt** - User experience design

## Key Improvements Over Full Council

### 1. Reduced Redundancy
- **Removed**: `code_reviewer_auto`, `spec_validator_auto`, `security_expert_auto`, `ux_designer_auto`
- **Integrated**: Their essential functions into the coach and simplicity advocate
- **Result**: 50% faster council sessions without quality loss

### 2. Smart Evidence Requirements
The coach now follows **lean verification principles**:

**Ask For:**
- ✅ Test results: "Run tests and show results"
- ✅ High-risk code: "Show me the tricky part of [feature]"
- ✅ Key functionality: "Demonstrate the main user flow"
- ✅ Trust simple implementations and well-written tests

**Avoid Bureaucracy:**
- ❌ Don't ask for every line of code
- ❌ Don't demand complete implementation proof
- ❌ Don't over-verify simple, standard patterns

### 3. Enhanced Appended Prompt
All auto-members receive this instruction:

```
**LEAN COUNCIL MODE**: You're the primary quality gate. Focus on smart verification:

**SMART EVIDENCE REQUIREMENTS**:
- ✅ Ask for tests: "Run tests and show results" 
- ✅ Ask for high-risk code: "Show me the tricky part of [feature]"
- ✅ Ask for key functionality: "Demonstrate the main user flow"
- ✅ Trust simple implementations
- ✅ Trust well-written tests as evidence
- ❌ Don't ask for every line of code
- ❌ Don't demand complete implementation proof
- ❌ Don't over-verify simple, standard patterns

**FOCUS ON**:
- Complex or risky areas
- Test results and coverage  
- Key business logic
- Security or performance concerns
- Anything that seems incomplete or unclear
```

## When to Use Lean Council

### ✅ Perfect For:
- **Everyday development** - Most coding tasks and features
- **Rapid iteration** - Fast feedback loops
- **Standard implementations** - Well-understood requirements
- **Small to medium projects** - Where speed matters
- **Learning and prototyping** - Quick validation

### ❌ Consider Full Council For:
- **Mission-critical systems** - High stakes, zero tolerance for bugs
- **Complex domains** - Finance, healthcare, security systems
- **Large enterprise projects** - Multiple stakeholders, strict compliance
- **Educational purposes** - Learning different review perspectives
- **Quality audits** - When you need comprehensive analysis

## Response Structure

Auto-members follow this concise format:
```
1. **REQUESTS** - What was asked for (1 line max)
2. **ISSUES** - Critical problems only (bullet points, max 3)
3. **RECOMMENDATIONS** - Essential improvements only (bullet points, max 3)
4. **VOTE** - Final decision (MUST be on LAST LINE)
```

- **300 word limit** per response
- **Focus on critical issues only**
- **Mandatory voting** on last line
- **Technology-agnostic** testing requirements

## Benefits

### 🚀 **Faster Development**
- 50% reduction in council feedback time
- Less redundant commentary
- Faster iteration cycles

### 🎯 **Focused Quality**
- Smart verification of what matters
- Trust simple, standard implementations
- Focus energy on complex/risky areas

### 💪 **Maintainable Workflow**
- Works with any technology stack
- Compatible with any test runner
- Clear responsibility distribution

### ⚡ **Efficient Auto-Mode**
- Simple voting dynamics (2 members instead of 6)
- Reliable completion detection
- Less analysis paralysis

## Installation

```bash
# Copy to your project's .aicoder directory
cp -r docs/examples/council-lean/* .aicoder/council/
```

## Usage Examples

### Auto-Mode with Lean Council
```bash
/council --auto "Add user authentication with JWT tokens"
# Fast, focused feedback from coach and simplicity advocate
```

### Manual Session for Complex Review
```bash
/council
# Choose specific members for comprehensive review
```

## Real-World Impact

- **Session Time**: Reduced from 2-3 minutes to 30-60 seconds
- **Feedback Quality**: Maintained through smart verification
- **Developer Experience**: Less noise, more signal
- **Project Velocity**: Significantly improved iteration speed

## Evolution from Full Council

This lean configuration represents the evolution from comprehensive-but-slow to focused-and-fast council sessions. It maintains the essential quality gates while eliminating redundancy that often contributed to analysis paralysis in auto-mode sessions.

The lean council is the result of real-world usage optimization, prioritizing developer productivity without sacrificing code quality.

---

**This is the current production council configuration** - battle-tested and optimized for real development workflows.