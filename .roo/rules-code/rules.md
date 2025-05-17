- Maintain a file named library.md in the root of the project that you search for and before searching make sure that you check the file and use the library ID already available in the file. Otherwise, search for it.
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

  - **Available MCP Servers to use:**
    - Context7
    - brave-search
    - fetch
    - playwright
