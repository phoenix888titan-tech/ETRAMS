const http = require('http');
const { spawn } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = 'C:\\Users\\natha\\AppData\\Local\\Temp\\chrome_cdp_profile_3';

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
    const rawCookie = cookies ? cookies[0] : '';
    const tokenMatch = rawCookie.match(/etrams_token=([^;]+)/);
    const token = tokenMatch ? tokenMatch[1] : '';
    console.log('Obtained Auth Token:', token);

    const chromeProc = spawn(chromePath, [
      '--headless=new',
      '--remote-debugging-port=9222',
      `--user-data-dir=${userDataDir}`,
      'http://localhost:3000/login.html'
    ]);

    setTimeout(async () => {
      try {
        const listJson = await new Promise((resolve, reject) => {
          http.get('http://localhost:9222/json/list', (r) => {
            let data = '';
            r.on('data', (c) => (data += c));
            r.on('end', () => resolve(JSON.parse(data)));
          }).on('error', reject);
        });

        const target = listJson.find((t) => t.type === 'page');
        if (!target) {
          console.error('No page target found in Chrome');
          chromeProc.kill();
          return;
        }

        console.log('Connecting to Chrome WebSocket:', target.webSocketDebuggerUrl);
        const ws = new WebSocket(target.webSocketDebuggerUrl);

        let msgId = 1;
        const send = (method, params = {}) => {
          const id = msgId++;
          ws.send(JSON.stringify({ id, method, params }));
          return id;
        };

        ws.onopen = () => {
          console.log('WebSocket connected. Enabling Network, Page, Runtime...');
          send('Network.enable');
          send('Page.enable');
          send('Runtime.enable');

          send('Network.setCookie', {
            name: 'etrams_token',
            value: token,
            domain: 'localhost',
            path: '/',
            httpOnly: true
          });

          // First set sessionStorage on domain localhost
          setTimeout(() => {
            send('Runtime.evaluate', {
              expression: `
                sessionStorage.setItem('etrams_user', JSON.stringify({ id: 1, username: 'admin', fullName: 'System Admin', role: 'admin' }));
                console.log('SessionStorage primed:', sessionStorage.getItem('etrams_user'));
              `
            });

            // Now navigate to settings.html with session already primed
            setTimeout(() => {
              console.log('Navigating to settings.html with active session...');
              send('Page.navigate', { url: 'http://localhost:3000/settings.html' });
            }, 500);
          }, 500);
        };

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.method === 'Runtime.consoleAPICalled') {
            const args = msg.params.args.map((a) => a.value || a.description || JSON.stringify(a));
            console.log(`[BROWSER CONSOLE ${msg.params.type.toUpperCase()}]`, ...args);
          } else if (msg.method === 'Runtime.exceptionThrown') {
            console.error('[BROWSER EXCEPTION]', msg.params.exceptionDetails);
          } else if (msg.method === 'Page.loadEventFired') {
            send('Runtime.evaluate', {
              expression: `
                console.log('Navigated Title:', document.title);
                const root = document.getElementById('root');
                console.log('Root innerHTML length:', root ? root.innerHTML.length : 'NO ROOT');
              `
            });

            setTimeout(() => {
              send('Runtime.evaluate', {
                expression: `
                  const root = document.getElementById('root');
                  console.log('Rendered Root Preview:', root ? root.innerHTML.substring(0, 400) : 'NO ROOT');
                `
              });
              setTimeout(() => {
                ws.close();
                chromeProc.kill();
                process.exit(0);
              }, 1500);
            }, 2500);
          }
        };

      } catch (err) {
        console.error('CDP error:', err);
        chromeProc.kill();
      }
    }, 2000);
  }
);

req.write(postData);
req.end();
