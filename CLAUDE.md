@AGENTS.md

The Claude Code agents and skills for this workflow ship in the agent-playbook
plugin (`agent-playbook:<name>`); their behavior is defined by the shared files
in `docs/agent-workflows/`, so never duplicate workflow rules inside them.

The repository's earlier Claude Code adapters are still in `.claude/agents/`
([se-product-manager](.claude/agents/se-product-manager.md),
[software-design](.claude/agents/software-design.md),
[software-engineer-agent-v1](.claude/agents/software-engineer-agent-v1.md),
[qa-reviewer](.claude/agents/qa-reviewer.md)) and `.claude/skills/`. They
predate the playbook; prefer the plugin's agents and skills.
