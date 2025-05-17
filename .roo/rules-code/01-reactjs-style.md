---
description: Best practices and architectural guidelines for writing clean, scalable, and maintainable ReactJS applications.
globs: ["src/**/*.js", "src/**/*.jsx", "src/**/*.ts", "src/**/*.tsx"]
alwaysApply: true
---

# ReactJS Style Guide and Clean Architecture Principles

This guide combines general React best practices with Clean Architecture principles to help build robust, scalable, and maintainable applications.

## 1. Core Principles

- **Separation of Concerns (SoC):**
  - Clearly divide responsibilities between different parts of your application (UI, state management, business logic, data fetching).
  - Strive for components and modules that do one thing well.
- **Dependency Inversion Principle (DIP):**
  - High-level modules (e.g., business logic) should not depend on low-level modules (e.g., specific data fetching libraries). Both should depend on abstractions (interfaces/types).
  - This promotes loose coupling and testability.
- **Single Responsibility Principle (SRP):**
  - Applied to components, functions, and modules. Each should have only one reason to change.
- **Don't Repeat Yourself (DRY):**
  - Avoid code duplication by abstracting common logic into reusable functions, hooks, or components.

## 2. Application Architecture (Inspired by Clean Architecture)

Structure your application into logical layers to manage complexity and improve maintainability.

### 2.1. View Layer (Presentation)

- **Purpose:** Responsible for rendering the UI and handling user interactions.
- **Characteristics:**
  - Contains React components (functional components with Hooks are preferred).
  - Components should be "dumb" or "presentational" as much as possible, receiving data and callbacks via props.
  - Focus on how things look and feel.
  - Minimal business logic.
- **Example:**

  ```tsx
  // src/components/User/UserProfile.tsx
  interface UserProfileProps {
    name: string;
    email: string;
    onEdit: () => void;
  }

  const UserProfile: React.FC<UserProfileProps> = ({ name, email, onEdit }) => (
    <div>
      <h2>{name}</h2>
      <p>{email}</p>
      <button onClick={onEdit}>Edit Profile</button>
    </div>
  );

  export default UserProfile;
  ```

### 2.2. UseCase Layer (Application Business Logic)

- **Purpose:** Orchestrates the application's specific business rules and workflows. Connects the View Layer to the Domain/Repository Layers.
- **Characteristics:**
  - Contains application-specific logic (e.g., what happens when a user submits a form).
  - May transform data from repositories into a format suitable for the View Layer (ViewModels).
  - Should be independent of UI frameworks.
  - Often implemented as functions or classes.
- **Example:**

  ```typescript
  // src/usecases/User/fetchUserProfileUseCase.ts
  import { userRepository } from "@/repositories/UserRepository"; // Depends on abstraction
  import { UserProfileViewModel } from "@/viewmodels/UserProfileViewModel";

  export const fetchUserProfileUseCase = async (
    userId: string
  ): Promise<UserProfileViewModel | null> => {
    const user = await userRepository.getUserById(userId);
    if (!user) return null;
    return {
      id: user.id,
      displayName: `${user.firstName} ${user.lastName}`,
      emailAddress: user.email,
      // ... other view-specific transformations
    };
  };
  ```

### 2.3. Domain Layer / Services (Core Business Logic & Entities)

- **Purpose:** Contains enterprise-wide business logic and business objects (entities). This logic is independent of any application-specific behavior.
- **Characteristics:**
  - Pure business rules, calculations, validations.
  - Should have no dependencies on UI, databases, or external frameworks.
  - Entities represent core business concepts.
- **Example:**

  ```typescript
  // src/domain/services/OrderService.ts
  import { Order, OrderItem } from "@/domain/entities/Order";

  export class OrderService {
    static calculateTotal(order: Order): number {
      return order.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
    }

    static canCancelOrder(order: Order): boolean {
      return order.status === "PENDING";
    }
  }
  ```

### 2.4. Repository Layer (Data Abstraction)

- **Purpose:** Abstracts data access logic. Provides a clean API for UseCases to interact with data sources without knowing the underlying implementation (e.g., REST API, localStorage, GraphQL).
- **Characteristics:**
  - Defines interfaces for data operations (CRUD).
  - Implementations (Adapters) handle the actual data fetching/storage.
- **Example (Interface):**

  ```typescript
  // src/repositories/UserRepository.ts
  import { User } from "@/domain/entities/User";

  export interface IUserRepository {
    getUserById(id: string): Promise<User | null>;
    saveUser(user: User): Promise<void>;
  }
  ```

### 2.5. Adapter Layer (Data Implementation)

- **Purpose:** Concrete implementations of Repository interfaces. Interacts with external systems like databases, APIs, etc.
- **Characteristics:**
  - Translates data between the format used by the external system and the domain entities.
- **Example (Implementation):**

  ```typescript
  // src/adapters/UserApiAdapter.ts
  import { IUserRepository } from "@/repositories/UserRepository";
  import { User } from "@/domain/entities/User";
  import apiClient from "./apiClient"; // Your HTTP client instance

  export class UserApiAdapter implements IUserRepository {
    async getUserById(id: string): Promise<User | null> {
      const response = await apiClient.get(`/users/${id}`);
      if (!response.data) return null;
      // Map API response to User domain entity
      return {
        id: response.data.id,
        firstName: response.data.first_name /* ...other fields */,
      };
    }

    async saveUser(user: User): Promise<void> {
      // Map User domain entity to API request format
      await apiClient.post("/users", {
        first_name: user.firstName /* ...other fields */,
      });
    }
  }
  // Dependency injection would typically provide this instance
  // For example, in a DI container setup:
  // container.register('IUserRepository', { useClass: UserApiAdapter });
  // export const userRepository: IUserRepository = container.resolve('IUserRepository');
  // Or a simpler manual instantiation for this example:
  export const userRepository: IUserRepository = new UserApiAdapter();
  ```

## 3. Component Design and Patterns

### 3.1. Functional Components and Hooks

- **Prefer Functional Components:** Use functional components with Hooks over class components for conciseness and easier logic reuse.
- **Custom Hooks:** Extract component logic into reusable custom Hooks (`useMyLogic()`). This is key for:
  - Separating stateful logic from rendering.
  - Sharing logic between components.
  - Improving testability.
  - Example: `useFetch` for data fetching.

### 3.2. Container vs. Presentational Components (Conceptual)

- While Clean Architecture layers provide a more formal separation, the concept is still useful:
  - **Presentational Components:** Focus on UI. Receive data and callbacks via props. (Belongs to View Layer)
  - **Container Components (or Hook-driven components):** Manage state, fetch data (often via UseCases or custom Hooks), and pass data down to presentational components. (Connects View Layer to UseCase Layer)

### 3.3. Higher-Order Components (HOCs) & Render Props

- **HOCs:** Functions that take a component and return a new component with enhanced props/behavior. Use judiciously, as Hooks often provide a more straightforward solution.
- **Render Props:** Components that take a function prop to share logic by rendering what the function returns. Hooks have largely superseded this pattern for many use cases.

## 4. State Management

- **Local State (`useState`, `useReducer`):** Use for component-specific state.
- **Context API (`useContext`):** For global state that doesn't change frequently or for passing data deep down the component tree without prop drilling. Be mindful of performance implications with frequent updates.
- **External Libraries (Redux, Zustand, Jotai, etc.):** Consider for complex global state management, especially in larger applications. Choose based on project needs and team familiarity.
  - **Reducers:** When using Redux or `useReducer`, consider using an object map for action handlers instead of `switch` statements for better readability if there are many action types.

## 5. File Structure and Naming Conventions

### 5.1. Feature-First or Layer-First?

- **Feature-First (Recommended for Scalability):** Organize files by feature/module, then by layer within each feature.
  ```
  src/
    features/
      UserProfile/
        components/       # View Layer (Presentational Components)
          UserProfileDisplay.tsx
          EditProfileForm.tsx
        hooks/            # Custom hooks for this feature
          useUserProfile.ts
        usecases/         # UseCase Layer
          updateUserProfileUseCase.ts
        viewmodels/       # ViewModels specific to this feature
          UserProfileViewModel.ts
        index.ts          # Barrel file for the feature
      OrderManagement/
        # ... similar structure
    common/               # Shared components, hooks, utils
      components/
      hooks/
    domain/
      entities/
        User.ts
        Order.ts
      services/
        AuthService.ts
    repositories/         # Repository interfaces
      IUserRepository.ts
      IOrderRepository.ts
    adapters/             # Repository implementations
      UserApiAdapter.ts
      OrderApiAdapter.ts
    config/
    lib/                  # General utility functions, helpers
    App.tsx
    index.tsx
  ```
- **Layer-First:** Group files by their architectural layer. Can be simpler for smaller projects but may become harder to navigate as the project grows.
  ```
  src/
    components/  # View Layer
    pages/       # View Layer (often route components)
    hooks/       # Custom Hooks (can be feature-specific or common)
    usecases/    # UseCase Layer
    services/    # Domain Services
    repositories/# Repository Interfaces & Adapters (or separate adapters)
    domain/      # Domain Entities
    # ...
  ```

### 5.2. Naming Conventions

- **Components, HOCs, Hooks (custom):** `PascalCase` (e.g., `UserProfile.tsx`, `withAuth.tsx`, `useFormInput.ts`)
- **Files:** Match the default export name (e.g., `UserProfile.tsx` exports `UserProfile`).
- **Folders:** `camelCase` or `kebab-case` for features/modules (e.g., `userProfile` or `user-profile`). `PascalCase` if a folder directly represents a major component.
- **Functions (non-component), Variables:** `camelCase` (e.g., `fetchData`, `userName`)
- **Constants:** `UPPER_SNAKE_CASE` (e.g., `MAX_USERS`)
- **Interfaces/Types (TypeScript):** `PascalCase` (e.g., `interface IUserProps`, `type UserId = string;`)
- **CSS Modules:** `ComponentName.module.css` (e.g., `UserProfile.module.css`)
- **Test Files:** `ComponentName.test.tsx` or `fileName.spec.ts`

## 6. Performance Optimization

- **Code Splitting:** Use `React.lazy()` and `Suspense` to split code by routes or features, improving initial load time.
- **Memoization:** Use `React.memo` for components, `useMemo` for expensive calculations, and `useCallback` for functions passed as props to prevent unnecessary re-renders.
- **Lazy Loading Images/Assets:** Defer loading of off-screen or non-critical assets.
- **Virtualization:** For long lists, use libraries like `react-window` or `react-virtualized`.

## 7. Styling

- **CSS Modules:** Scoped CSS by default, good for component-based styling.
- **Styled-Components / Emotion (CSS-in-JS):** Dynamic styling, theming capabilities.
- **Tailwind CSS:** Utility-first CSS framework for rapid UI development.
- Choose one approach and be consistent.

## 8. Typing (TypeScript)

- **Embrace TypeScript:** Strongly recommended for type safety, better autocompletion, and refactoring confidence.
- **Define Props and State:** Clearly type component props and state.
- **Utility Types:** Leverage TypeScript's utility types (`Partial`, `Pick`, `Omit`, etc.).
- **Avoid `any`:** Use `unknown` or more specific types instead of `any` where possible.

## 9. Linting and Formatting

- **ESLint:** Enforce code quality and consistency. Configure with React-specific plugins (`eslint-plugin-react`, `eslint-plugin-react-hooks`, `eslint-plugin-jsx-a11y`).
- **Prettier:** Automate code formatting for a consistent style across the codebase.
- **Integrate with Git Hooks:** Use tools like Husky and lint-staged to run linters/formatters before commits.

## 10. Testing

- **Unit Tests:** Test individual components, hooks, and utility functions in isolation (e.g., using Jest, React Testing Library).
- **Integration Tests:** Test interactions between components or layers.
- **End-to-End (E2E) Tests:** Test complete user flows (e.g., using Cypress, Playwright).
- **Strive for High Coverage:** Especially for business logic (UseCases, Services) and complex UI interactions.
- **Testability by Design:** Clean Architecture and SoC make testing easier.
