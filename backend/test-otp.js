const { pool } = require('./src/config/db');
const http = require('http');
const app = require('./src/app');

async function makeRequest(path, payload) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(payload);
    const req = http.request({
      hostname: 'localhost',
      port: process.env.TEST_PORT || 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function run() {
  const server = app.listen(3000, async () => {
    try {
      console.log('1. Setting admin mobile number to 9876543210...');
      await pool.query("UPDATE users SET mobile = '9876543210' WHERE login_id = 'admin'");
    
    console.log('2. Requesting OTP...');
    const reqRes = await makeRequest('/api/auth/forgot-password/request-otp', { phone: '9876543210' });
    console.log('OTP Request Response:', reqRes);
    
    // Get OTP from DB since SMS provider is just logging
    const otpRes = await pool.query("SELECT otp_hash FROM otp_requests WHERE phone = '9876543210' ORDER BY created_at DESC LIMIT 1");
    if (otpRes.rows.length > 0) {
      console.log('Found OTP hash in DB. (Since we cannot reverse hash, we should rely on console output of the server, or we can use the dev mode trick).');
    }
    
    if (reqRes.data._dev_otp) {
      console.log('3. Verifying OTP:', reqRes.data._dev_otp);
      const verRes = await makeRequest('/api/auth/forgot-password/verify-otp', { phone: '9876543210', otp: reqRes.data._dev_otp });
      console.log('Verify Response:', verRes);
      
      if (verRes.data.reset_token) {
        console.log('4. Resetting password...');
        const resetRes = await makeRequest('/api/auth/forgot-password/reset', { 
          reset_token: verRes.data.reset_token, 
          new_password: 'newpassword123', 
          confirm_password: 'newpassword123' 
        });
        console.log('Reset Response:', resetRes);
      }
    } else {
      console.log('No _dev_otp found in response. Ensure NODE_ENV=development.');
    }
    
    } catch (err) {
      console.error(err);
    } finally {
      server.close();
      process.exit(0);
    }
  });
}

run();
