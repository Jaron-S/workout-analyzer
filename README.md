# Intelligent Workout Analyzer

A data-driven fitness planner for creating and analyzing hypertrophy-focused workout routines with a real-time coaching engine.

[**Live Demo**](workout-analyzer.netlify.app)

## About This Project

Intelligent Workout Analyzer is a sophisticated web application designed for fitness enthusiasts to build, manage, and analyze their training programs based on established scientific principles of muscle growth. The core of the application is a real-time analysis engine that provides instant, actionable feedback on every user interaction, creating a "live coaching" experience.

This project was built to demonstrate proficiency in architecting complex, state-intensive front-end applications with a heavy focus on user experience, performance optimization, and interactive data visualization, all built on a modern, serverless architecture.

-----

## Key Features

  * **Interactive Routine Builder:** Create and customize multi-day workout splits with an intuitive drag-and-drop interface.
  * **Real-Time Analysis Engine:** Get instant feedback across three distinct tabs as you build your routine:
      * **Volume Analysis:** Compares your weekly training volume for each muscle group against scientific landmarks (MV, MEV, MAV, MRV).
      * **Priority Analysis:** Provides personalized coaching and recommendations based on your self-defined physique goals and priority tiers.
      * **Fatigue Management:** Analyzes per-session fatigue, "junk volume" risks, and training frequency to ensure your program is sustainable and effective.
  * **Personalized Goal Setting:** A unique drag-and-drop interface allows you to create your own S-F tier list of muscle groups, which directly drives the app's coaching feedback.
  * **Secure User Accounts:** Full authentication powered by **Firebase Auth**, with user data securely stored and synced across devices using **Firestore**.
  * **Seamless Guest Mode:** The entire application is fully functional without an account, with all data persisted in `localStorage` for a frictionless user experience.

-----

## Tech Stack

| Category      | Technology                                                                                                                                                                                           |
| :------------ | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Framework** | [Next.js](https://nextjs.org/)                                                                                                                                                        |
| **Backend** | [Firebase](https://firebase.google.com/) (Auth, Firestore)                                                                                                                                           |
| **Language** | [TypeScript](https://www.typescriptlang.org/)                                                                                                                                                        |
| **Styling** | [Tailwind CSS](https://tailwindcss.com/)                                                                                                                                                             |
| **UI/UX** | [shadcn/ui](https://ui.shadcn.com/), [Framer Motion](https://www.framer.com/motion/), [dnd-kit](https://dndkit.com/), [Recharts](https://recharts.org/)                                                   |
| **Deployment** | [Vercel](https://vercel.com/)                                                                                                                                                                        |

-----

## Technical Deep Dive

This project presented several interesting technical challenges that required thoughtful architectural decisions.

### 1\. Real-Time Performance Optimization

The core feature of the app is its "live" analysis engine. Every user interaction—from changing the number of sets on an exercise to dragging it to a different day—triggers a complete recalculation of dozens of data points across all three analysis tabs.

  * **Challenge:** Naively recalculating on every render would lead to significant UI lag and a poor user experience, especially on lower-end devices.
  * **Solution:** React's `useMemo` hook was leveraged extensively to create a memoized dependency graph. Complex calculations (like `calculateMuscleVolumes`) are only re-run when their direct dependencies (`routine`, `exercises`) change. Downstream transformations in each analysis tab are then memoized based on the result of these core calculations. This ensures a highly performant and fluid user experience, even with frequent and rapid state updates.

### 2\. Complex Drag-and-Drop State Management

The routine builder is built around a sophisticated drag-and-drop system that allows users to reorder exercises within a day, move them between days, and add new exercises from a library.

  * **Challenge:** Managing the state for a multi-container drag-and-drop system is notoriously complex and prone to bugs.
  * **Solution:** The `dnd-kit` library was chosen for its robust, headless architecture. A deep understanding of its sensors, collision detection algorithms, and event listeners was required to implement a predictable and intuitive state management solution that correctly handles all user interactions and edge cases, ensuring the `routine` object remains consistent and accurate at all times.

### 3\. Iterative Design of Data Visualizations

The goal was to present complex scientific training data in a way that was immediately understandable and actionable. This required a deliberate and iterative design process for the data visualizations.

  * **Challenge:** Initial designs, such as using a simple progress bar for fatigue, proved to be confusing and failed to communicate the intended meaning.
  * **Solution:** Each visualization was refined through multiple iterations. The "Fatigue Meter" evolved from a simple progress bar into a more effective segmented bar to show the crossing of thresholds. The "Priority Analysis" bar was redesigned from a progress indicator into a "Target Zone" visual to better represent the goal of landing within a specific range. This iterative process was crucial for achieving the app's goal of providing clear, at-a-glance coaching.

-----

## Getting Started

To run this project locally, follow these steps:

### Prerequisites

  * Node.js (v18.0 or later)
  * A Firebase project with Authentication and Firestore enabled.

### Installation

1.  Clone the repository:

    ```bash
    git clone https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
    cd YOUR_REPO_NAME
    ```

2.  Install dependencies:

    ```bash
    npm install
    ```

3.  Set up your environment variables. Create a `.env.local` file in the root of the project and add your Firebase project configuration:

    ```
    NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_auth_domain
    NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
    NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
    NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
    ```

4.  Run the development server:

    ```bash
    npm run dev
    ```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
