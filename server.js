/**
 * server.js
 * 
 * Node.js Express সার্ভার যা Email ও OTP গ্রহণ করবে।
 * Email sanitization করবে sheet name হিসেবে এবং
 * Google Sheets থেকে email ও otp মিলিয়ে ভ্যালিডেশন করবে।
 * যদি মিলবে, তাহলে সফল response দিবে,
 * না হলে error message পাঠাবে।
 */

const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { google } = require('googleapis');
require('dotenv').config(); // .env ফাইল থেকে environment variables লোড করবে

const app = express();
const PORT = process.env.PORT || 3000;

// CORS ও JSON পার্সার মিডলওয়্যার ব্যবহার করছি
app.use(cors());
app.use(bodyParser.json());

/**
 * Google Sheets API credentials ও স্কোপ সেটআপ
 */
const SCOPES = ['https://www.googleapis.com/auth/spreadsheets'];

// GOOGLE_CREDENTIALS environment variable থেকে ক্রেডেনশিয়াল নিয়ে JSON parse করা হচ্ছে
const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS);

const auth = new google.auth.GoogleAuth({
  credentials: creds,
  scopes: SCOPES,
});

const sheets = google.sheets({ version: 'v4', auth });

// তোমার স্প্রেডশিট আইডি (Google Sheet URL থেকে নেওয়া)
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

/**
 * Email sanitization: sheet name হিসেবে ব্যবহার করার জন্য special character গুলো "_" দিয়ে রিপ্লেস করা হয়।
 * যেমন: user@example.com -> user_example_com
 */
function sanitizeSheetName(email) {
  return email.replace(/[^a-zA-Z0-9]/g, "_");
}

/**
 * POST /validate-otp
 * Request body: { email: string, otp: string }
 * Response: 
 *  - সফল হলে: { success: true }
 *  - ব্যর্থ হলে: { success: false, error: string }
 */
app.post('/validate-otp', async (req, res) => {
  const { email, otp } = req.body;

  // Email ও OTP অবশ্যই দিতে হবে
  if (!email || !otp) {
    return res.status(400).json({ success: false, error: 'Email and OTP are required.' });
  }

  // OTP ৬ অক্ষরের না হলে error দিবে
  if (otp.length !== 6) {
    return res.status(400).json({ success: false, error: 'Please enter the correct OTP.' });
  }

  // sanitized email থেকে Google Sheet এর sheet name পাওয়া যাবে
  const sheetName = sanitizeSheetName(email);

  try {
    // Google Sheets থেকে sheet এর A1 (email) ও A3 (otp) cell থেকে ডাটা পড়া
    const emailCell = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1`,
    });

    const otpCell = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A3`,
    });

    const emailInSheet = emailCell.data.values ? emailCell.data.values[0][0] : null;
    const otpInSheet = otpCell.data.values ? otpCell.data.values[0][0] : null;

    // আসল Email ও OTP মিলানো (email sanitize নয়)
    if (email === emailInSheet && otp === otpInSheet) {
      // মিললে শুধু success: true রেসপন্স দিবে
      return res.status(200).json({ success: true });
    } else {
      // না মিললে error রেসপন্স দিবে
      return res.status(401).json({ success: false, error: 'Please enter the correct OTP.' });
    }

  } catch (error) {
    console.error('Error accessing Google Sheets:', error.message);
    return res.status(500).json({ success: false, error: 'Internal server error.' });
  }
});

// সার্ভার লিসেন শুরু
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
