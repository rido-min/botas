# Squad ↔ Gemini CLI Integration

This repository uses the Squad framework for AI team orchestration, with configuration stored in the `.squad/` directory.

To ensure Gemini CLI can effectively participate in this project and leverage the specialized agents, it must map the existing Squad agents to **Gemini CLI Custom Subagents**.

## How to Configure Subagents

When asked to configure or sync subagents, the Gemini agent MUST perform the following steps:

1. **Read the Squad Roster:** 
   Review `.squad/team.md` to identify all active team members and their roles.

2. **Parse Charters:**
   For each agent listed, read their charter file located at `.squad/agents/<lowercase-name>/charter.md`.

3. **Generate Gemini Subagent Files:**
   Create a `.gemini/agents/<lowercase-name>.md` file for each Squad agent. The file MUST follow this schema:

   ```markdown
   ---
   name: <lowercase-name>
   description: <Role and 1-2 sentence summary of Expertise from charter.md>
   tools:
     - *
   ---
   # Charter
   [Insert the full content of the agent's charter.md here]
   
   # Squad Workflow Instructions
   - You are operating within the Squad framework.
   - Always read `.squad/decisions.md` before making architectural decisions.
   - When you complete a task, record your learnings in `.squad/agents/<lowercase-name>/history.md`.
   - If you make a team-relevant decision, write it to `.squad/decisions/inbox/<lowercase-name>-<slug>.md` for the Scribe to merge.
   - DO NOT modify other agents' histories.
   ```

4. **Scribe Agent:**
   The Scribe agent (`.squad/agents/scribe/charter.md`) is responsible for merging decisions from `.squad/decisions/inbox/` into `.squad/decisions.md` and maintaining the orchestration log. Ensure its Gemini subagent is configured to execute these specific file operations.

5. **Finalize:**
   After generating or updating the `.gemini/agents/*.md` files, instruct the user to run `/agents reload` in their Gemini CLI to register the new subagents.

## Task Delegation (Routing)

When users issue broad requests to Gemini CLI, Gemini should act as the Coordinator and delegate to the appropriate subagent based on `.squad/routing.md`. For example:

- .NET tasks → `@amy`
- Node.js tasks → `@fry`
- Python tasks → `@hermes`
- E2E testing → `@nibbler`
- DevOps/CI/CD → `@bender`
- Architecture/Parity/Reviews → `@leela`
- Docs/Samples → `@kif`

**Important:** Never execute domain-specific tasks directly if a subagent exists for it. Always invoke the appropriate subagent using the `invoke_agent` tool or the `@<name>` syntax.
