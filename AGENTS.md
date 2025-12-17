# Agent Guidelines for Trace Development

## Git Workflow

**IMPORTANT**: Do NOT commit code without user approval.

### Rules
1. ✅ Make changes to files
2. ✅ Explain what was changed
3. ⏸️ **WAIT** for user to review and test
4. ⏸️ User will commit when ready
5. ❌ Do NOT auto-commit unless explicitly requested

### When User Says "Commit This"
Only then run:
```bash
git add -A
git commit -m "User-approved message"
git push origin main
```

## Development Workflow

1. **Make changes** - Edit files as needed
2. **Explain changes** - Show what was done and why
3. **Let user test** - User reviews and tests locally
4. **User commits** - User decides when to commit

## Testing Before Commit

Code should be:
- ✅ Reviewed by user
- ✅ Tested locally
- ✅ Working as expected
- ✅ No obvious bugs

## Phase Work

When completing a phase:
- Make all changes
- Document what was built
- Let user test everything
- User commits when satisfied

---

**Remember**: User is in control of git. We write code, user commits code.

