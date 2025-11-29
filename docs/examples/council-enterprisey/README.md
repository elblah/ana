# Council System Examples

This directory contains example council member configurations for the AI Coder Council system.

## Quick Setup

1. **Create council directory:**
   ```bash
   mkdir -p ~/.config/aicoder-mini/council
   ```

2. **Copy members you want:**
   ```bash
   # Pre-idea members (review plans before implementation)
   cp preidea_*.txt ~/.config/aicoder-mini/council/
   
   # Post-implementation members (review completed code)
   cp posimplementation_*.txt ~/.config/aicoder-mini/council/
   
   # Always include moderator
   cp moderator.txt ~/.config/aicoder-mini/council/
   ```

3. **Test your council:**
   ```bash
   # In AI Coder, after the AI proposes a plan:
   /council
   ```

## Council Members Explained

### Pre-Idea Members (Review Plans)
Use these **before** implementing to catch issues early:

- `preidea_simplicity_advocate.txt` - Prevents over-engineering
- `preidea_security_expert.txt` - Identifies security issues  
- `preidea_ux_designer.txt` - Focuses on user experience
- `preidea_performance_guru.txt` - Considers performance implications
- `preidea_feasibility_checker.txt` - Assesses realistic implementation

### Post-Implementation Members (Review Code)
Use these **after** implementation to ensure quality:

- `posimplementation_code_reviewer.txt` - Code quality and maintainability
- `posimplementation_testing_guru.txt` - Test coverage and quality

### Required Members

- `moderator.txt` - **Required** - Synthesizes all opinions into final recommendation

## Usage Examples

### **Pre-Implementation Review:**
```bash
# Get all pre-idea opinions
/council preidea

# Get specific expert opinions
/council preidea,security

# Focus on simplicity and UX
/council preidea,simplicity,ux
```

### **Post-Implementation Review:**
```bash
# Review completed implementation
/council posimplementation

# Focus on code quality and testing
/council posimplementation,code,testing
```

### **Full Council:**
```bash
# All members (default)
/council
```

## Council Session Workflow

1. **AI proposes a plan or completes implementation**
2. **User runs council command** with appropriate filters
3. **Each member provides opinion** based on their expertise
4. **Moderator synthesizes** consensus or explains disagreements
5. **User can accept plan** with `/council accept` to inject feedback

## Customizing Members

Feel free to edit the `.txt` files to match your preferences:

- Modify expertise focus
- Adjust personality and tone
- Add domain-specific requirements
- Change priority weighting

## Advanced Usage

### **Project-Specific Councils:**
```bash
# For web projects
cp preidea_ux_designer.txt ~/.config/aicoder-mini/council/web_ux.txt

# For API projects  
cp preidea_security_expert.txt ~/.config/aicoder-mini/council/api_security.txt

# Use specific experts
/council web,api
```

### **Domain-Specific Prompts:**
Customize prompts for your specific needs:
- Frontend development focus
- Backend systems focus
- Data processing focus
- DevOps deployment focus

## Tips

1. **Start with core members** (simplicity + security + moderator)
2. **Add specialists** based on project needs
3. **Customize prompts** to match your development style
4. **Use pre-idea reviews** to catch issues early
5. **Use post-implementation reviews** for quality assurance

The council system becomes more valuable as you customize it to your specific development patterns and project types.