# Technology-Agnostic Auto Council

This is the current production council configuration optimized for auto-mode sessions with technology-agnostic testing requirements.

## Features

### Auto-Mode Optimized
- All members ending with `_auto` are optimized for automated council sessions
- Structured response format with concise analysis
- Mandatory voting system with `IMPLEMENTATION_FINISHED` / `IMPLEMENTATION_NOT_FINISHED`
- 300-word limit to prevent analysis paralysis

### Technology-Agnostic Testing
- Removed bun-specific obligations (`bun test` commands)
- Uses generic "RUN TESTS NOW" commands
- Compatible with any test runner (npm test, pytest, cargo test, etc.)
- Maintains rigorous testing requirements without technology lock-in

### Response Structure
All auto-members follow this format:
```
1. **REQUESTS** - What was asked for (1 line max)
2. **ISSUES** - Critical problems only (bullet points, max 3)
3. **RECOMMENDATIONS** - Essential improvements only (bullet points, max 3)
4. **VOTE** - Final decision (MUST be on LAST LINE)
```

## Council Members

### Auto Members (For Automated Sessions)
- **coach_auto.txt** - Collaborative implementation guide and final decision maker
- **code_reviewer_auto.txt** - Code quality and testing verification
- **spec_validator_auto.txt** - Requirements compliance verification
- **simplicity_advocate_auto.txt** - Complexity prevention and simplicity standards

### Regular Members (For Manual Sessions)
- **coach.txt** - Implementation guidance and collaboration
- **code_reviewer.txt** - Code quality review
- **spec_validator.txt** - Specification compliance
- **simplicity_advocate.txt** - Simplicity and complexity review
- **security_expert.txt** - Security analysis
- **ux_designer.txt** - User experience design

### Inactive Members
- **_security_expert_auto.txt** - Security expert auto version (inactive)
- **_ux_designer_auto.txt** - UX designer auto version (inactive)

## Key Improvements

### 1. Technology Agnostic
- ❌ Old: `RUN TESTS NOW: bun test`
- ✅ New: `RUN TESTS NOW`

### 2. Concise Analysis
- Maximum 300 words per response
- 1-line limit for REQUESTS section
- 3-bullet maximum for ISSUES and RECOMMENDATIONS

### 3. Enhanced Voting Detection
- Vote must be on LAST LINE of response
- Clear voting options: `IMPLEMENTATION_FINISHED` or `IMPLEMENTATION_NOT_FINISHED`

### 4. Evidence-Based Review
- All auto-members must demand evidence of implementation
- Test suite execution is mandatory before completion
- Full test output must be provided as proof

## Usage

### For Auto-Mode Sessions
Use the `_auto` members when running `/council --auto <spec>`:
- They provide structured, concise responses
- Always end with a clear vote
- Focus on completion vs not-finished decisions

### For Manual Sessions
Use regular members for detailed, collaborative reviews:
- More conversational and detailed feedback
- Flexible response formats
- Better for complex implementation discussions

## Installation

To use this council configuration:
```bash
# Copy to your project's .aicoder directory
cp -r docs/examples/council-agnostic-auto/* .aicoder/council/
```

## Benefits

1. **Universal Compatibility**: Works with any technology stack and test runner
2. **Efficient Auto-Mode**: Optimized for rapid, decisive council sessions
3. **Quality Assurance**: Maintains rigorous standards while being technology-neutral
4. **Reduced Analysis Paralysis**: Clear structure prevents overly verbose responses
5. **Consistent Voting**: Reliable vote detection ensures proper auto-mode loop completion

This configuration represents the evolution from technology-specific councils to a universal, efficient auto-council system suitable for any development environment.