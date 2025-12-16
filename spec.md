# Council Management System Specification

**Goal**: Enhance the council system with numbered listing, easy editing, and execution order control while keeping it simple and following KISS principles.

## Background

There is a council of experts which is a dynamic way to create a simple yet powerful way to help the main AI and even the user to keep on track. They opinionate based on their expertise based on the current context (memory) of the AI. There is a special way to make the intelligence of the way to look at the problem from many perspectives.

I will divide blocks/sections with 5- Ex: -----

What I want is a way to edit/create the council members files easily.

/council list current stdout this:

> /council list
Council Members:

Using Project Council:
  /home/blah/poc/aicoder/tsv/.aicoder/council

Members:
  • _code_reviewer_auto
  • _security_expert_auto
  • _spec_validator_auto
  • _ux_designer_auto
  • coach_auto
  • code_reviewer
  • security_expert
  • simplicity_advocate
  • simplicity_advocate_auto
  • spec_validator
  • ux_designer

I'd like it to list based on numbers. Example:

> /council list
Council Members:

Using Project Council:
  /home/blah/poc/aicoder/tsv/.aicoder/council

Members:
  1) _code_reviewer_auto
  2) _security_expert_auto
  3) _spec_validator_auto
  4) _ux_designer_auto
  5) coach_auto
  6) code_reviewer
  7) security_expert
  8) simplicity_advocate
  9) simplicity_advocate_auto
  10) spec_validator
  11) ux_designer


I'd also prefer the members to be listed alphabetically and number aware ordering
that would help me keep some ordering if I want

ex:
  1) 1_first_council_member_whatever
  2) 2_second_council_member

**Sorting Algorithm**: Use natural sort order that is number-aware:
- Files with numeric prefixes are sorted numerically: 1_blah < 2_blah < 10_blah < 20_blah
- Files without numbers are sorted alphabetically after numbered files
- Users can name files however they want - system will handle natural sorting appropriately

-----

Council members execution order should follow the number/alphabetically ordering of the list as 
defined in the previous section

**Why this matters**: Some AIs give more weight to content at the beginning or end of messages. This provides simple control over expert opinion ordering and influence.

-----

I'd like to be able to create or edit members by number or name like

/council edit 2
or
/council edit coach_auto

if edited by name and the files does not exist then it is created in the council dir

ex: /council edit new_member_file_name

**Edit Command Details**:
- Edit works on enabled, disabled, or non-existent members
- Numbers refer to position in the sorted list
- Names can include or exclude the underscore prefix
- If file doesn't exist, it's created
- File extension (.txt) is optional in commands - add automatically if missing
- Always edit in the current project's council directory (.aicoder/council)

i want the council files to be edited like the /edit or /memory command where they open a tmux new window but in their case you can point directly to the file in the council dir

so /council edit coach_auto will execute $EDITOR $PROJECT_DIR/.aicoder/council/coach_auto

-----

I'd also like to be able to enable or disable a member easily

**Enable/Disable Logic**:
- **Disable**: Add underscore prefix to filename (if not already present)
- **Enable**: Remove underscore prefix from filename (if present)  
- Never add multiple underscores - only one at the beginning maximum
- Numbers refer to position in sorted list
- Works with or without file extension

disable means to rename a member with a _ in the begininig (it the name already has a _ then it is already disabled... don't add more than one _ at the beginning or a council file name)

ex:
/council disable 6
or
/council disable code_reviewer
or
/council enable _ux_designer_auto
or
/council enable 4

**Simple Error Handling**:
- Non-existent member: "Member does not exist"
- Already enabled: "Member already enabled" or just success message  
- Already disabled: "Member already disabled" or just success message
- Invalid number: Show error with valid range


-----

Also when i run a council i can filter by name or part of the name... i want to be able to filter by number based on the number of the /council list

**Member Selection for Council Execution**:
- Numbers refer to positions in the sorted list, NOT name patterns
- Comma-separated list of numbers
- The selected members execute in the same order as they appear in the sorted list
- This gives control over which experts participate and their execution order

example: to run a council for members code_reviwer, security_expert and ux_designer i could do
/council --members 6,7,11 please check it we are on the right track 

-----

## Implementation Guidelines

**🔥 CRITICAL: PRESERVE ALL EXISTING FUNCTIONALITY**

This specification is an **IMPROVEMENT ONLY** - all existing council command features MUST continue working exactly as they do now.

**DO NOT BREAK** any of these existing features:
- `/council <message>` - Full council with all members (existing behavior)
- `/council --direct <message>` - Direct expert opinions (existing behavior)  
- `/council --members name1,name2 <message>` - Filter by name patterns (existing behavior)
- `/council --auto <spec.md>` - Auto-mode functionality (existing behavior)
- `/council --auto --reset-context/--no-reset <spec.md>` - Context control (existing behavior)
- `/council current` - Show current plan (existing behavior)
- `/council accept` - Accept and inject plan (existing behavior)
- `/council clear` - Clear session (existing behavior)
- `/council help` - Help system (existing behavior)
- All existing member filtering, auto-mode logic, moderator behavior, etc.

**The new features ADD to existing ones, they do NOT replace them:**
- NEW: Numbered listing (`/council list`)
- NEW: Edit by number (`/council edit <number>`)
- NEW: Enable/disable by number (`/council enable/disable <number>`)
- NEW: Number-based member selection (`/council --members 6,7,11`)
- ENHANCED: Existing name-based editing now supports disabled/non-existent members

**Implementation Strategy:**
1. Add new functionality without removing/changing existing logic
2. Extend existing commands with new options where appropriate
3. Maintain backward compatibility for all existing command patterns
4. Test all existing features work exactly as before

**Testing Note**: Don't make tests that really run the $EDITOR on TMUX because they really open an editor and this is annoying.

**KISS Principle**: Keep it simple - no complex validation, no enterprise-grade bureaucracy. Users should understand the system intuitively.

**File Operations**: Always operate on files in the current project's council directory (.aicoder/council).

**Messages**: Keep all user-facing messages simple and direct.

