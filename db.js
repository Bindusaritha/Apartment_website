// ==============================================================================
// GateNest - Apartment Visitor Management System
// File: db.js - MySQL Database Connection Pool
// ==============================================================================

const mysql = require("mysql2/promise");
require("dotenv").config();

// Create a connection pool to local MySQL Server
const pool = mysql.createPool({
    host: process.env.DB_HOST || "localhost",
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || "apartment_visitor_management",
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    dateStrings: true // Return date/time as 'YYYY-MM-DD HH:mm:ss' formatted strings
});

// Immediate connection verification test
(async () => {
    try {
        const connection = await pool.getConnection();
        console.log("=================================================");
        console.log(" GateNest: MySQL Database Connected Successfully!");
        console.log(` Database : ${process.env.DB_NAME || "apartment_visitor_management"}`);
        console.log(` Host     : ${process.env.DB_HOST || "localhost"}:${process.env.DB_PORT || 3306}`);
        console.log("=================================================");
        connection.release();
    } catch (err) {
        console.error("❌ GateNest: MySQL Connection Failed!");
        console.error(`Details: ${err.message}`);
        console.error("Please verify credentials in your .env file and ensure MySQL Server is running.");
    }
})();

module.exports = pool;
