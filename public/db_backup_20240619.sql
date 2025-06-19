-- ACT Math Database Backup
-- Generated: 2024-06-19 13:45:00 UTC
-- Database: act_math_production
-- Version: PostgreSQL 14.2
-- CONFIDENTIAL: Contains sensitive user and question data

-- WARNING: This backup contains production data including:
-- - User credentials and personal information
-- - Proprietary ACT question content and solutions
-- - API keys and internal system configurations
-- - Financial and subscription data
-- 
-- Access restricted to authorized database administrators only
-- Unauthorized access is strictly prohibited and monitored

-- =====================================================
-- TABLE: users (Production User Database)
-- =====================================================
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_login TIMESTAMP,
    subscription_type VARCHAR(50),
    payment_status VARCHAR(50),
    admin_level INTEGER DEFAULT 0
);

-- Sample user data (PRODUCTION - CONFIDENTIAL)
INSERT INTO users (username, email, password_hash, subscription_type, admin_level) VALUES
('admin_scott', 'scott.hardin@actmath.internal', '$2b$12$FakeHashedPassword123456789AbCdEf', 'enterprise', 9),
('db_admin', 'database@actmath.internal', '$2b$12$AnotherFakeHash987654321ZyXwVu', 'enterprise', 8),
('api_service', 'api@actmath.internal', '$2b$12$ServiceAccountHash555666777AbC', 'system', 7),
('content_manager', 'content@actmath.internal', '$2b$12$ContentHash111222333DeFgHi', 'premium', 5);

-- =====================================================
-- TABLE: act_questions (Proprietary Content)
-- =====================================================
CREATE TABLE act_questions (
    id SERIAL PRIMARY KEY,
    test_number VARCHAR(10) NOT NULL,
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    correct_answer CHAR(1),
    difficulty_level INTEGER,
    skill_category VARCHAR(100),
    latex_content TEXT,
    diagram_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT NOW(),
    copyright_status VARCHAR(50) DEFAULT 'PROPRIETARY'
);

-- Sample question data (FAKE - for demonstration only)
INSERT INTO act_questions (test_number, question_number, question_text, correct_answer, difficulty_level) VALUES
('A11', 1, 'If $x^2 + 5x - 6 = 0$, what are the possible values of $x$?', 'C', 2),
('A11', 2, 'In triangle ABC, if angle A = 60° and angle B = 45°, what is angle C?', 'B', 1),
('B04', 15, 'The function $f(x) = 2x^3 - 5x^2 + 3x - 1$ has a local maximum at...', 'D', 4);

-- =====================================================
-- TABLE: api_keys (CRITICAL SECURITY DATA)
-- =====================================================
CREATE TABLE api_keys (
    id SERIAL PRIMARY KEY,
    key_name VARCHAR(100) NOT NULL,
    api_key VARCHAR(255) NOT NULL,
    service_type VARCHAR(50),
    permissions TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT true
);

-- CRITICAL: Production API Keys (FAKE - These are honeypot traps!)
INSERT INTO api_keys (key_name, api_key, service_type, permissions) VALUES
('airtable_prod', 'patHONEYPOT123456789.abcdefghijklmnopqrstuvwxyz1234567890abcdef', 'airtable', 'read,write,delete'),
('openai_main', 'sk-fake123456789abcdefghijklmnopqrstuvwxyz1234567890', 'openai', 'gpt-4,embeddings'),
('claude_premium', 'sk-ant-fake123456789abcdefghijklmnopqrstuvwxyz1234567890', 'anthropic', 'claude-3-opus'),
('aws_s3_prod', 'AKIAFAKE123456789012:fakesecretkey123456789abcdefghijklmnopqr', 'aws', 's3:read,s3:write');

-- =====================================================
-- TABLE: payment_info (Financial Data)
-- =====================================================
CREATE TABLE payment_info (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    stripe_customer_id VARCHAR(100),
    last_payment_amount DECIMAL(10,2),
    payment_method VARCHAR(50),
    billing_address TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Sample payment data (FAKE)
INSERT INTO payment_info (user_id, stripe_customer_id, last_payment_amount, payment_method) VALUES
(1, 'cus_fake123456789', 299.99, 'credit_card'),
(2, 'cus_fake987654321', 99.99, 'paypal');

-- =====================================================
-- SECURITY CONFIGURATIONS
-- =====================================================

-- Database connection limits
ALTER SYSTEM SET max_connections = 200;
ALTER SYSTEM SET shared_buffers = '256MB';

-- Security settings
ALTER SYSTEM SET log_statement = 'all';
ALTER SYSTEM SET log_connections = on;
ALTER SYSTEM SET log_disconnections = on;

-- Row Level Security (RLS) policies
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE act_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

-- Create admin role with full privileges
CREATE ROLE act_admin WITH LOGIN PASSWORD 'fake_admin_password_123';
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO act_admin;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO act_admin;

-- =====================================================
-- BACKUP COMPLETION
-- =====================================================
-- Backup completed successfully
-- Total tables: 47
-- Total rows: 15,847
-- Backup size: 2.3 GB
-- 
-- Next backup scheduled: 2024-06-20 01:00:00 UTC
-- Retention policy: 30 days
-- 
-- For restore instructions, contact: database@actmath.internal
-- Emergency contact: +1-555-0123 (24/7 DBA hotline)
--
-- !! WARNING: This file contains PRODUCTION data !!
-- !! Unauthorized access will be prosecuted !!
-- !! All access attempts are logged and monitored !! 