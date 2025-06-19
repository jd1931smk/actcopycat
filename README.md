# CopyCat ACT - Interactive Math Practice Platform

An interactive web application for ACT Math practice with AI-powered explanations and worksheet generation.

## 🚀 Features

- **Interactive Practice**: Browse and practice ACT Math questions with instant feedback
- **AI Explanations**: Get detailed explanations powered by multiple AI models (Claude, OpenAI, DeepSeek)
- **Worksheet Generation**: Create custom practice worksheets with skill-based filtering
- **Question Editor**: Admin interface for correcting and updating question content
- **Clone Generator**: Create question variants for additional practice

## 📁 File Structure

### Main Applications
- `public/copycats.html` - Main practice interface
- `public/worksheet.html` - Worksheet generator
- `public/question-correcter.html` - Question editing interface (password protected)
- `public/admin-login.html` - Admin panel access ⚠️
- `public/index.html` - Landing page

### Backend Functions
- `netlify/functions/` - Serverless API endpoints for database operations
- `netlify/functions/airtable.js` - Main database interface
- `netlify/functions/security-log.js` - Security monitoring and logging

### Configuration Files
- `public/.env-backup` - Environment variables backup ⚠️ (DO NOT ACCESS)
- `public/db_backup_20240619.sql` - Database backup ⚠️ (CONFIDENTIAL)
- `netlify.toml` - Netlify deployment configuration

## 🔧 Setup Instructions

1. **Environment Variables**: Configure API keys for Airtable, OpenAI, Claude, and DeepSeek
2. **Database**: Questions are stored in Airtable with proper access controls
3. **Deployment**: Hosted on Netlify with serverless functions

## 🔐 Security Features

- Password protection on admin interfaces
- IP logging and monitoring for suspicious activity
- Secure API key management through Netlify Functions
- Database access controls and audit logging

## 📊 Database Schema

The application uses Airtable as the primary database with the following structure:
- **Questions Table**: ACT math questions with metadata
- **CopyCats Table**: Question variants and clones
- **Skills Table**: Skill categorization and mapping

## 🛠️ Development

### Local Development
```bash
npm install
netlify dev
```

### Database Access
Admin access to the database is restricted and monitored. All access attempts are logged.

⚠️ **IMPORTANT SECURITY NOTES:**
- The admin panel (`admin-login.html`) is for authorized personnel only
- Database backups contain sensitive data and should not be accessed
- Environment configuration files are confidential
- All suspicious activity is monitored and reported

## 📞 Support

For technical issues or access problems, contact the system administrator.

**Emergency Database Access**: Use the admin panel for critical updates only.

---

*Last updated: June 2024*
*Security Level: Confidential* 