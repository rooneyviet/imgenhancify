---
description: Guidelines for creating and maintaining Roo Code rules to ensure consistency and effectiveness.
globs: .roo/rules/*.md
alwaysApply: true
---

- **Required Rule Structure:**

  ```markdown
  ---
  description: Clear, one-line description of what the rule enforces
  globs: path/to/files/*.ext, other/path/**/*
  alwaysApply: boolean
  ---

  - **Main Points in Bold**
    - Sub-points with details
    - Examples and explanations
  ```

- **File References:**

  - Use `[filename](mdc:path/to/file)` ([filename](mdc:filename)) to reference files
  - Example: [prisma.md](mdc:.roo/rules/prisma.md) for rule references
  - Example: [schema.prisma](mdc:prisma/schema.prisma) for code references

- **Code Examples:**

  - Use language-specific code blocks

  ```typescript
  // ✅ DO: Show good examples
  const goodExample = true;

  // ❌ DON'T: Show anti-patterns
  const badExample = false;
  ```

- **Rule Content Guidelines:**

  - Start with high-level overview
  - Include specific, actionable requirements
  - Show examples of correct implementation
  - Reference existing code when possible
  - Keep rules DRY by referencing other rules

- **Rule Maintenance:**

  - Update rules when new patterns emerge
  - Add examples from actual codebase
  - Remove outdated patterns
  - Cross-reference related rules

- **Best Practices:**

  - Use bullet points for clarity
  - Keep descriptions concise
  - Include both DO and DON'T examples
  - Reference actual code over theoretical examples
  - Use consistent formatting across rules
  - **Keeping Functions Short and Focused:**
    - Functions should be small and perform a single, well-defined task.
    - This helps to improve readability and maintainability by reducing the cognitive load required to understand the code.
    - The "Single Responsibility Principle" (SRP) is a core concept here.
    - A function should have a single reason to change.
  - **Avoiding Duplication:**
    - Eliminate redundant code by identifying and extracting common logic into reusable functions or classes.
    - The "Don't Repeat Yourself" (DRY) principle encourages this.
    - This reduces code size, improves maintainability, and prevents errors from spreading.
  - **Minimizing Side Effects:**
    - Functions should ideally have few or no side effects, meaning they should primarily perform the task they are designed for and not modify global variables or other unrelated parts of the system.
    - Side effects can make debugging and reasoning about the code more difficult.
  - **Expressiveness and Clarity:**

    - Write code that is easy to understand and follow, even for those unfamiliar with the codebase.
    - Prioritize readability over conciseness.
    - Avoid overly complex expressions or logic that might be difficult to understand.

  - **Error Handling:**
    - Implement robust error handling to gracefully handle unexpected situations and prevent the application from crashing.
