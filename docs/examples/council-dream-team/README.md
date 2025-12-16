# 🌟 AI Coder Mini Dream Team Council

## 📋 **Council Architecture Overview**

The Dream Team represents two distinct council systems designed for different purposes:

### **🎯 Auto-Council (Spec-Based Review)**
- **Files**: `*_auto.txt`
- **Purpose**: Implementation quality control against specifications
- **Trigger**: `/council --auto spec.md`
- **Role**: Gatekeepers ensuring ALL requirements are met
- **Decision Making**: Unanimous approval required (IMPLEMENTATION_FINISHED)

### **🧠 Normal Council (Context-Based Advisory)**
- **Files**: `*.txt` (without _auto suffix)
- **Purpose**: Expert opinions based on current conversation context
- **Trigger**: `/council` (auto mode off)
- **Role**: Professional advisors providing expertise and insights
- **Decision Making**: No voting - provides guidance and recommendations

---

## 🚀 **Auto-Council Members (Spec Reviewers)**

### **👨‍🏫 Coach** (`coach_auto.txt`)
**Role**: Specification guardian and implementation quality controller
- Enforces specification compliance
- Ensures all requirements are demonstrably satisfied
- Maintains coding standards and simplicity principles
- **Key Focus**: "Show me evidence this requirement is met"

### **🛡️ Security Expert** (`security_expert_auto.txt`)
**Role**: Security implementation reviewer
- Validates security measures are appropriate and sufficient
- Prevents over-engineering of security features
- Ensures input validation and error handling
- **Key Focus**: "Show me security implementation for X"

### **📝 Code Reviewer** (`code_reviewer_auto.txt`)
**Role**: Code quality and engineering standards reviewer
- Enforces clean code practices and maintainability
- Validates proper error handling and type safety
- Ensures adherence to coding standards
- **Key Focus**: "Show me code quality evidence for Y"

### **✨ Simplicity Advocate** (`simplicity_advocate_auto.txt`)
**Role**: Code simplicity and maintainability reviewer
- Enforces maximum 2-3 nesting levels
- Promotes guard clauses and early returns
- Prevents over-engineering and unnecessary complexity
- **Key Focus**: "Show me simplified code structure for Z"

### **🎨 UX Designer** (`ux_designer_auto.txt`)
**Role**: User interface and experience reviewer
- Validates user experience implementation
- Ensures intuitive interface design
- Reviews user feedback and interaction flows
- **Key Focus**: "Show me user interface for feature A"

### **📋 Spec Validator** (`spec_validator_auto.txt`)
**Role**: Requirements compliance reviewer
- Validates every specification requirement is met
- Ensures no missing features or incomplete implementation
- Checks edge cases and boundary conditions
- **Key Focus**: "Show me implementation of requirement B"

---

## 🧠 **Normal Council Members (Context Advisors)**

### **👨‍🏫 Development Coach** (`coach.txt`)
**Role**: Development strategy and process advisor
- Analyzes current development approach
- Provides strategic recommendations
- Helps navigate development challenges
- **Key Focus**: "Based on this context, my coaching expertise suggests..."

### **🛡️ Security Expert** (`security_expert.txt`)
**Role**: Security risk assessment advisor
- Analyzes security implications of current approach
- Provides risk assessment and mitigation strategies
- Recommends appropriate security measures
- **Key Focus**: "Based on this context, my security expertise indicates..."

### **📝 Software Engineering Expert** (`code_reviewer.txt`)
**Role**: Engineering and architecture advisor
- Analyzes technical approach and design decisions
- Provides architectural recommendations
- Assesses technical quality and maintainability
- **Key Focus**: "Based on this context, my engineering expertise suggests..."

### **✨ Simplicity Expert** (`simplicity_advocate.txt`)
**Role**: Simplicity and maintainability advisor
- Analyzes complexity in current approach
- Provides simplification recommendations
- Advises on maintainability strategies
- **Key Focus**: "Based on this context, my simplicity expertise suggests..."

### **🎨 User Experience Expert** (`ux_designer.txt`)
**Role**: User experience and interface advisor
- Analyzes UX implications of current approach
- Provides user-centered design recommendations
- Advises on usability and accessibility
- **Key Focus**: "Based on this context, my UX expertise indicates users would..."

### **📋 Specification Expert** (`spec_validator.txt`)
**Role**: Requirements and specification advisor
- Analyzes current requirements and clarity
- Provides specification improvement recommendations
- Advises on requirements completeness
- **Key Focus**: "Based on this context, my specification expertise suggests..."

---

## 🔄 **Usage Patterns**

### **For Specification-Driven Development**
```bash
# Review implementation against specification
/council --auto your-spec.md
# Result: All auto-members vote IMPLEMENTATION_FINISHED/NOT_FINISHED
# System continues until unanimous approval achieved
```

### **For Expert Consultation**
```bash
# Get expert opinions on current situation
/council
# Result: All normal members provide professional recommendations
# No voting - just guidance and insights
```

---

## 🎯 **Key Design Principles**

### **Auto-Council Principles**
- **Evidence-Based**: Always demands to see actual implementation
- **Specification-Focused**: Reviews against documented requirements
- **Quality Gates**: Unanimous approval required for completion
- **Implementation-Only**: Reviews what was built, not what should be built

### **Normal Council Principles**
- **Context-Aware**: Analyzes current conversation and situation
- **Expertise-Driven**: Provides professional opinions based on experience
- **Recommendation-Focused**: Offers guidance, not requirements
- **Flexible**: Applicable to any development context or situation

---

## 🌟 **Why Two Systems?**

The dual council architecture serves different needs:

1. **Auto-Council**: Quality control for specification-driven development
   - Ensures no requirements are missed
   - Enforces coding standards and quality
   - Prevents incomplete implementations

2. **Normal Council**: Expert guidance for exploratory development
   - Provides professional insights on current challenges
   - Helps navigate complex technical decisions
   - Offers strategic advice without rigid requirements

Both systems work together to provide comprehensive AI development support - from exploratory advice to rigorous quality control.

---

## 🚀 **Getting Started**

1. **For Expert Advice**: Run `/council` in any development context
2. **For Spec Review**: Create a specification file and run `/council --auto your-spec.md`
3. **For Custom Teams**: Modify individual member profiles to match your needs

The Dream Team is designed to be both comprehensive and adaptable, supporting any development workflow or project type.