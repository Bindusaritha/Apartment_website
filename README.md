# GateNest - Apartment Visitor Management System

An academic Full-Stack Development (FSD) web application built using **Node.js, Express.js, Vanilla CSS, Frontend JavaScript, and MySQL Database Server**.

---

##  Project Overview & Branding

- **Project Title:** Apartment Visitor Management System
- **Website Brand Name:** **GateNest (Smart Visitor Security & Access Management)**
- **Theme:** Modern Deep Navy Blue (`#0B132B`), Teal (`#00B4D8`), Emerald Green (`#10B981`), Clean Slate White
- **Target Audience:** Apartment Security Personnel, Resident Welfare Associations (RWA), Gated Community Management

---

## 🏗️ Folder Structure

```
d:/js prog/apartment_website/
├── server.js               # Express.js REST API backend server
├── db.js                   # MySQL2 promise connection pool
├── init_db.js              # Database & tables creation script with seed data
├── package.json            # Project dependencies & npm scripts
├── .env                    # Environment credentials (DB host, user, password, port)
├── .env.example            # Template for environment configuration
├── .gitignore              # Ignores node_modules and .env
├── README.md               # Complete academic documentation
│
└── public/
    ├── index.html          # Page 1: Home / Security Dashboard with live statistics
    ├── list.html           # Page 2: Resident and Visitor Directory listings with search
    ├── delete.html         # Page 3: Delete Records Console with ON DELETE RESTRICT safety
    ├── listone.html        # Page 4: Single Record Inspector & Printable Visitor Pass
    ├── update.html         # Page 5: Update Records Console with prefilled forms
    ├── style.css           # Premium Vanilla CSS Design System
    ├── script.js           # Core client-side API integration logic
    │
    └── images/
        ├── logo.svg               # Vector brand logo
        ├── logo.png               # PNG brand logo
        ├── apartment-banner.jpg   # Luxury apartment entrance banner
        ├── apartment-building.jpg # Architectural luxury condominium exterior
        ├── security-guard.jpg     # Smart CCTV / security checkpoint gate
        └── visitor-management.jpg # Modern lobby digital visitor kiosk
```

---

## 🗄️ MySQL Database Architecture

The application connects to **one single MySQL database** named `apartment_visitor_management` containing **three relational tables** running on the InnoDB storage engine:

### 1. `residents`
Stores apartment resident details:
- `resident_id` (INT, PRIMARY KEY, AUTO_INCREMENT)
- `name` (VARCHAR(100), NOT NULL)
- `flat_no` (VARCHAR(20), NOT NULL)
- `phone` (VARCHAR(15), NOT NULL)
- `email` (VARCHAR(100), NULL)
- `created_at` (TIMESTAMP)

### 2. `visitors`
Stores unique visitor profile records:
- `visitor_id` (INT, PRIMARY KEY, AUTO_INCREMENT)
- `name` (VARCHAR(100), NOT NULL)
- `phone` (VARCHAR(15), NOT NULL)
- `vehicle_no` (VARCHAR(30), NULL)
- `purpose` (VARCHAR(150), NOT NULL)
- `created_at` (TIMESTAMP)

### 3. `visits`
Relational table recording entries and exits:
- `visit_id` (INT, PRIMARY KEY, AUTO_INCREMENT)
- `resident_id` (INT, NOT NULL, FOREIGN KEY -> `residents.resident_id`)
- `visitor_id` (INT, NOT NULL, FOREIGN KEY -> `visitors.visitor_id`)
- `entry_time` (DATETIME, NOT NULL)
- `exit_time` (DATETIME, NULL)
- `status` (VARCHAR(20), NOT NULL, DEFAULT `'Inside'`)

### Foreign Key Protection (`ON DELETE RESTRICT`)
Both foreign keys in `visits` enforce `ON DELETE RESTRICT`:
```sql
CONSTRAINT fk_visits_resident FOREIGN KEY (resident_id) 
    REFERENCES residents(resident_id) 
    ON DELETE RESTRICT ON UPDATE CASCADE,

CONSTRAINT fk_visits_visitor FOREIGN KEY (visitor_id) 
    REFERENCES visitors(visitor_id) 
    ON DELETE RESTRICT ON UPDATE CASCADE
```
*Why this is important:* Security and audit integrity. If security staff attempts to delete a resident or visitor who has visit logs in the building, MySQL prevents deletion and returns an error explaining that historical visit logs reference this record.

---

## 🚀 How to Run the Project

### 1. Verify MySQL Server
Ensure your local MySQL service (e.g. `MySQL80`) is running. Check credentials in `.env`:
```env
PORT=3000
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=Nidiganti@2006
DB_NAME=apartment_visitor_management
DB_PORT=3306
```

### 2. Install Dependencies (if not already installed)
In `d:\js prog\apartment_website`:
```bash
npm install
```

### 3. Initialize / Seed Database
Run the setup script:
```bash
npm run init-db
```
This automatically creates the database, all three tables, and seeds sample data.

### 4. Start the Application
```bash
npm start
```
The server will start at:
**`http://localhost:3000`**

Open `http://localhost:3000` in any web browser.

---

## 🔍 How to Verify in MySQL Workbench

1. Open **MySQL Workbench**.
2. Connect to your `Local instance MySQL80` using `root` and your password.
3. In the Schemas tab on the left, locate `apartment_visitor_management`.
4. Right-click any table (`residents`, `visitors`, `visits`) and click **Select Rows - Limit 1000**.
5. You can also execute:
   ```sql
   USE apartment_visitor_management;
   SELECT * FROM residents;
   SELECT * FROM visitors;
   SELECT * FROM visits;
   ```
6. When you add, edit, or check out visitors through the website, re-run the queries in MySQL Workbench to see the changes reflected live!
