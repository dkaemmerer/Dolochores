# DoloChores - A Family Chore Management App

This is a simple web application for managing household chores, recreated from an AppSheet app design. It allows family members to see their assigned chores, track due dates, and manage tasks.

## Features

-   View all chores, filter by assignee, or see a list of priority tasks.
-   Add, edit, and delete chores.
-   Mark chores as complete and toggle their priority.
-   Load chore data from a CSV file.

## Setup and Installation

1.  **Clone the repository** (or ensure you have the project files).

2.  **Create and activate a virtual environment** (recommended):
    ```bash
    python -m venv venv
    source venv/bin/activate  # On Windows, use `venv\Scripts\activate`
    ```

3.  **Install the dependencies**:
    ```bash
    pip install -r requirements.txt
    ```

## Running the Application

1.  **Initialize the Database**:
    Before running the app for the first time, you need to create the database tables.
    ```bash
    flask init-db
    ```
    *Note: If you want to start with a clean database at any time, you can use `flask reset-db`.*

2.  **(Optional) Load Chores from CSV**:
    If you have a `chores.csv` file with chore data, you can load it into the database using the following command:
    ```bash
    flask load-chores chores.csv
    ```
    *You can specify a different path to your CSV file.*

3.  **Run the Development Server**:
    ```bash
    flask run
    ```
    The application will be available at `http://127.0.0.1:5000`.
