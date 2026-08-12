@AGENTS.md

Claude Code agent adapters live in `.claude/agents/`:
[se-product-manager](.claude/agents/se-product-manager.md),
[software-design](.claude/agents/software-design.md),
[software-engineer-agent-v1](.claude/agents/software-engineer-agent-v1.md),
and [qa-reviewer](.claude/agents/qa-reviewer.md). Their behavior is defined
by the shared files in `docs/agent-workflows/`; do not duplicate workflow
rules inside the adapters.
