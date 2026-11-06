// ==============================================================================
// GateNest - Apartment Visitor Management System
// File: init_db.js - Database & Relational Tables Initializer
// ==============================================================================

const mysql = require("mysql2/promise");
require("dotenv").config();

async function initDatabase() {
    console.log("Connecting to MySQL server at " + (process.env.DB_HOST || "localhost") + ":" + (process.env.DB_PORT || 3306) + " as " + (process.env.DB_USER || "root") + "...");
    
    // Connect without database first
    const connection = await mysql.createConnection({
        host: process.env.DB_HOST || "localhost",
        user: process.env.DB_USER || "root",
        password: process.env.DB_PASSWORD,
        port: Number(process.env.DB_PORT) || 3306
    });

    console.log(" Connected to MySQL server successfully!");

    const dbName = process.env.DB_NAME || "apartment_visitor_management";
    await connection.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    console.log(` Database '${dbName}' verified/created!`);

    await connection.query(`USE \`${dbName}\`;`);

    // Table 1: residents
    await connection.query(`
        CREATE TABLE IF NOT EXISTS residents (
            resident_id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100) NOT NULL,
            flat_no VARCHAR(20) NOT NULL,
            phone VARCHAR(15) NOT NULL,
            email VARCHAR(100) NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;
    `);
    console.log(" Table 1: 'residents' verified.");

    // Table 2: visitors
    await connection.query(`
        CREATE TABLE IF NOT EXISTS visitors (
            visitor_id INT PRIMARY KEY AUTO_INCREMENT,
            name VARCHAR(100) NOT NULL,
            phone VARCHAR(15) NOT NULL,
            vehicle_no VARCHAR(30) NULL,
            purpose VARCHAR(150) NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB;
    `);
    console.log(" Table 2: 'visitors' verified.");

    // Table 3: visits (with foreign keys and ON DELETE RESTRICT)
    await connection.query(`
        CREATE TABLE IF NOT EXISTS visits (
            visit_id INT PRIMARY KEY AUTO_INCREMENT,
            resident_id INT NOT NULL,
            visitor_id INT NOT NULL,
            entry_time DATETIME NOT NULL,
            exit_time DATETIME NULL,
            status VARCHAR(20) NOT NULL DEFAULT 'Inside',
            CONSTRAINT fk_visits_resident FOREIGN KEY (resident_id) 
                REFERENCES residents(resident_id) 
                ON DELETE RESTRICT 
                ON UPDATE CASCADE,
            CONSTRAINT fk_visits_visitor FOREIGN KEY (visitor_id) 
                REFERENCES visitors(visitor_id) 
                ON DELETE RESTRICT 
                ON UPDATE CASCADE
        ) ENGINE=InnoDB;
    `);
    console.log(" Table 3: 'visits' verified with Foreign Keys (ON DELETE RESTRICT).");

    // Check if initial sample data exists
    const [residentRows] = await connection.query("SELECT COUNT(*) AS count FROM residents");
    if (residentRows[0].count === 0) {
        console.log(" Seeding initial academic demonstration records...");

        await connection.query(`
            INSERT INTO residents (name, flat_no, phone, email) VALUES
            ('Dr. Rajesh Sharma', 'A-101', '9876543210', 'rajesh.sharma@gmail.com'),
            ('Priya Deshmukh', 'A-204', '9823012345', 'priya.deshmukh@yahoo.com'),
            ('Vikramaditya Verma', 'B-302', '9911223344', 'vikram.verma@outlook.com'),
            ('Ananya Sengupta', 'B-405', '9845098450', 'ananya.s@gmail.com'),
            ('Col. Sanjay Kulkarni', 'C-102', '9765432109', 'sanjay.kulkarni@gmail.com');
        `);

        await connection.query(`
            INSERT INTO visitors (name, phone, vehicle_no, purpose) VALUES
            ('Amit Patil', '9123456780', 'MH-12-AB-1234', 'Amazon Package Delivery'),
            ('Sunita Rao', '9234567891', 'MH-14-CD-5678', 'Family Guest Visit'),
            ('Ramesh Kumar', '9345678902', NULL, 'AC Maintenance & Repair'),
            ('Deepak Nair', '9456789013', 'KA-05-XY-9087', 'Interior Carpentry Work'),
            ('Neha Joshi', '9567890124', 'MH-12-EF-4321', 'Friend Weekend Catchup');
        `);

        await connection.query(`
            INSERT INTO visits (resident_id, visitor_id, entry_time, exit_time, status) VALUES
            (1, 1, DATE_SUB(NOW(), INTERVAL 45 MINUTE), NULL, 'Inside'),
            (2, 2, DATE_SUB(NOW(), INTERVAL 2 HOUR), NULL, 'Inside'),
            (3, 3, DATE_SUB(NOW(), INTERVAL 4 HOUR), DATE_SUB(NOW(), INTERVAL 1 HOUR), 'Completed'),
            (4, 4, DATE_SUB(NOW(), INTERVAL 1 DAY), DATE_SUB(NOW(), INTERVAL 20 HOUR), 'Completed'),
            (5, 5, DATE_SUB(NOW(), INTERVAL 30 MINUTE), NULL, 'Inside');
        `);
        console.log(" Sample records successfully seeded!");
    }

    const [tables] = await connection.query("SHOW TABLES");
    console.log(" Verified tables in database:", tables.map(t => Object.values(t)[0]));

    await connection.end();
    console.log(" Database initialization verified 100%!");
}

initDatabase().catch(err => {
    console.error("❌ Initialization Failed:", err);
    process.exit(1);
});
