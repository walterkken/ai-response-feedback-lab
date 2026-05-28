# Promotion Plan

## Positioning

Name:

```text
AI Response Feedback Lab
```

One-line description:

```text
Mark AI answers segment by segment, then turn the feedback into a rewrite prompt.
```

Target users:

- people who repeatedly work with ChatGPT, Claude, Gemini, or local LLMs,
- prompt engineers,
- researchers building preference datasets,
- teams evaluating AI assistants,
- teachers and students who want to explain why an answer is good or bad.

## Launch Asset Checklist

Before public launch:

- `README.md` with one screenshot and one animated demo GIF,
- live demo through GitHub Pages,
- example JSON output,
- clear privacy statement: local-only, no server,
- issue templates for bugs and feature requests,
- 3 example workflows:
  - improve a technical explanation,
  - improve a trading-analysis answer,
  - improve a research-paper summary.

## GitHub Growth Plan

Repository topics:

```text
llm, ai-feedback, rlhf, prompt-engineering, annotation-tool, ai-evaluation
```

README structure:

1. one-line value proposition,
2. screenshot,
3. three-step workflow,
4. live demo link,
5. exported JSON schema,
6. roadmap,
7. contribution guide.

Early issues to open:

- browser extension support,
- import JSON support,
- side-by-side revision view,
- keyboard-first annotation flow,
- model API adapter.

## Distribution Channels

Use ethical distribution only:

- GitHub README and GitHub Pages demo,
- Show HN post after the demo is usable,
- Product Hunt launch after browser extension or API rewrite exists,
- Reddit posts only where self-promotion is allowed and the post includes a real
  demo and technical explanation,
- X / LinkedIn short demo thread,
- relevant Discord or Slack communities only when the tool solves a stated
  problem.

Avoid:

- fake stars,
- paid stars,
- spam comments,
- posting the same message across unrelated communities,
- claiming this is a full RLHF platform before it has model-training workflows.

References checked on 2026-05-28:

- GitHub Pages can publish static files directly from a repository:
  <https://docs.github.com/en/pages/getting-started-with-github-pages/creating-a-github-pages-site>
- Product Hunt recommends preparing maker launch assets before launch:
  <https://www.producthunt.com/launch>
- Reddit promotion should be community-first; read each community's rules before
  linking the project.

## First 7 Days

Day 1:

- finalize MVP,
- add screenshot,
- publish GitHub Pages.

Day 2:

- add 3 examples,
- create first 5 GitHub issues,
- write a short technical post: "Why coarse feedback makes AI rewriting worse."

Day 3:

- add import JSON and keyboard shortcuts.

Day 4:

- record a 30-second demo GIF.

Day 5:

- post to one technical community with a real problem statement.

Day 6:

- collect feedback,
- fix the top 3 friction points.

Day 7:

- write a release note and ask for targeted feedback from people who use AI for
  writing, coding, or research.

## Growth Loop

The product should generate its own useful artifacts:

```text
AI answer -> segment feedback -> revision prompt -> better answer -> example case
```

Every good example can become:

- a README demo,
- a blog post,
- an evaluation dataset row,
- a benchmark case,
- a social media clip.

This creates a real reason for users to star and share the repository.
