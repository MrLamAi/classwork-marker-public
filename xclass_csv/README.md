# xClass CSV Roster & Seating Format

This folder contains CSV templates compatible with classroom management systems such as **xClass**.

### CSV File Structure
- **Line 1:** `Teacher,<teacher_name>,,,`
- **Line 2:** `Class,<class_name>,,,`
- **Line 3:** Header `Computer Name,Student Name,Gender,X,Y`
- **Line 4+:** Student entries:
  - `Computer Name`: Client machine identifier (e.g., `PC01`, `K3150201`).
  - `Student Name`: Student name with class number in parentheses (e.g., `Chan Tai Man (01)`).
  - `Gender`: `M` (Male) or `F` (Female).
  - `X`: X coordinate in the classroom layout (pixels).
  - `Y`: Y coordinate in the classroom layout (pixels).

### Generating CSVs Offline
To batch-export classes from your configured database to this folder, ensure `DATABASE_URL` is set in `.env` and run:
```bash
npm run gen:xclass
```
