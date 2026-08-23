const http = require('http');
const { execSync } = require('child_process');

const postData = JSON.stringify({ username: 'admin', password: 'admin123' });

const req = http.request(
  {
    hostname: 'localhost',
    port: 3000,
    path: '/api/auth/login',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData)
    }
  },
  (res) => {
    const cookies = res.headers['set-cookie'];
    const cookieStr = cookies ? cookies[0].split(';')[0] : '';
    console.log('Admin Session Cookie:', cookieStr);

    const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
    const cmd = `"${chromePath}" --headless=new --dump-dom "http://localhost:3000/_test-settings.html"`;

    try {
      const output = execSync(cmd, { encoding: 'utf8', timeout: 10000 });
      const match = output.match(/<pre id="errlog">([\s\S]*?)<\/pre>/);
      if (match) {
        console.log('\n================ ERRLOG DUMP ================');
        console.log(match[1]);
        console.log('=============================================\n');
      } else {
        console.log('\nNo #errlog pre tag found. Output length:', output.length);
        console.log('Output preview:', output.substring(0, 500));
      }
    } catch (err) {
      console.error('Chrome exec error:', err.message);
    }
  }
);

req.write(postData);
req.end();
