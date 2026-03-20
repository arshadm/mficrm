import { getDb } from './database'

export function runMigrations() {
  const db = getDb()

  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email TEXT,
      role TEXT NOT NULL DEFAULT 'user',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS businesses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      stage TEXT NOT NULL DEFAULT 'initial_interest',
      description TEXT,
      listing_url TEXT,
      asking_price REAL,
      revenue_multiple REAL,
      trailing_12m_revenue REAL,
      trailing_12m_profit REAL,
      platform TEXT,
      date_listed DATE,
      date_added DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
      assigned_to INTEGER REFERENCES users(id),
      follow_up_date DATE,
      follow_up_note TEXT,
      is_archived BOOLEAN DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS business_case (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
      strategic_rationale TEXT,
      target_market TEXT,
      competitive_advantage TEXT,
      key_risks TEXT,
      assumptions TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS growth_plan (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
      year1_goals TEXT,
      year2_goals TEXT,
      marketing_strategy TEXT,
      product_roadmap TEXT,
      team_requirements TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS working_capital (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
      acquisition_cost REAL,
      legal_fees REAL,
      transition_costs REAL,
      initial_marketing_budget REAL,
      tech_infrastructure REAL,
      working_capital_buffer REAL,
      other_costs REAL,
      other_costs_notes TEXT,
      total_estimated REAL,
      funding_source TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS risk_checklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
      category TEXT,
      description TEXT NOT NULL,
      is_resolved BOOLEAN DEFAULT 0,
      resolved_note TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS valuation (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER UNIQUE REFERENCES businesses(id) ON DELETE CASCADE,
      valuation_method TEXT,
      estimated_value_low REAL,
      estimated_value_mid REAL,
      estimated_value_high REAL,
      initial_offer REAL,
      max_offer REAL,
      final_offer_made REAL,
      offer_notes TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS interactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id),
      type TEXT,
      title TEXT,
      body TEXT,
      occurred_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS attachments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      interaction_id INTEGER REFERENCES interactions(id) ON DELETE CASCADE,
      business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      mime_type TEXT,
      file_size INTEGER,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS next_steps (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      business_id INTEGER REFERENCES businesses(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      notes TEXT,
      due_date DATE NOT NULL,
      is_primary BOOLEAN DEFAULT 1,
      parent_id INTEGER REFERENCES next_steps(id) ON DELETE CASCADE,
      status TEXT DEFAULT 'pending',
      completion_note TEXT,
      completed_at DATETIME,
      completed_by INTEGER REFERENCES users(id),
      created_by INTEGER REFERENCES users(id),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `)

  // Add timezone column to users if not exists
  try { db.exec(`ALTER TABLE users ADD COLUMN timezone TEXT DEFAULT 'UTC'`) } catch {}
}
