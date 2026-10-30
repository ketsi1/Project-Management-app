// One shared MySQL connection pool plus small helpers for queries and transactions.
import mysql from 'mysql2/promise'
import { env } from '../config/env.js'

export const pool = mysql.createPool({
  ...env.db,
  waitForConnections: true,
  // Keep DATE columns as 'YYYY-MM-DD' strings so due dates never shift across time zones.
  dateStrings: ['DATE'],
  // Read and write TIMESTAMP columns in UTC.
  timezone: 'Z',
  charset: 'utf8mb4',
})

// Every new connection talks UTC, so CURRENT_TIMESTAMP and our ISO strings agree.
pool.on('connection', (connection) => {
  connection.query("SET time_zone = '+00:00'")
})

// Runs a query on the pool (or on a transaction's connection) and returns the rows.
export async function query(sql, params = [], connection = pool) {
  const [rows] = await connection.execute(sql, params)
  return rows
}

// Runs `work` inside a transaction. Commits if it finishes, rolls back if it throws.
export async function transaction(work) {
  const connection = await pool.getConnection()
  try {
    await connection.beginTransaction()
    const result = await work(connection)
    await connection.commit()
    return result
  } catch (error) {
    await connection.rollback()
    throw error
  } finally {
    connection.release()
  }
}

export async function checkDatabase() {
  await pool.query('SELECT 1')
}
