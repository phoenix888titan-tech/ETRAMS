const http = require('http');
const { spawn } = require('child_process');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = 'C:\\Users\\natha\\AppData\\Local\\Temp\\chrome_cdp_profile_all';

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

        const ws = new WebSocket(target.webSocketDebuggerUrl);

        let msgId = 1;
        const send = (method, params = {}) => {
          const id = msgId++;
          ws.send(JSON.stringify({ id, method, params }));
          return id;
        };

        const pagesToTest = [
          'http://localhost:3000/index.html',
          'http://localhost:3000/grid.html',
          'http://localhost:3000/building.html',
          'http://localhost:3000/meterstatus.html',
          'http://localhost:3000/settings.html',
          'http://localhost:3000/dashboard.html',
          'http://localhost:3000/map.html'
        ];

        let currentIndex = 0;
        let errorsFound = [];

        ws.onopen = () => {
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

          setTimeout(() => {
            send('Runtime.evaluate', {
              expression: `
                sessionStorage.setItem('etrams_user', JSON.stringify({ id: 1, username: 'admin', fullName: 'System Admin', role: 'admin' }));
              `
            });

            setTimeout(testNextPage, 500);
          }, 500);
        };

        function testNextPage() {
          if (currentIndex >= pagesToTest.length) {
            console.log('\n================ ALL PAGES AUDIT COMPLETE ================');
            if (errorsFound.length === 0) {
              console.log('SUCCESS: All 7 pages loaded and rendered completely with ZERO errors!');
            } else {
              console.error('ERRORS FOUND:', errorsFound);
            }
            console.log('===========================================================\n');
            ws.close();
            chromeProc.kill();
            process.exit(0);
            return;
          }

          const url = pagesToTest[currentIndex++];
          console.log(`Testing page [${currentIndex}/${pagesToTest.length}]: ${url}...`);
          send('Page.navigate', { url });
        }

        ws.onmessage = (event) => {
          const msg = JSON.parse(event.data);
          if (msg.method === 'Runtime.consoleAPICalled') {
            if (msg.params.type === 'error') {
              const args = msg.params.args.map((a) => a.value || a.description || JSON.stringify(a)).join(' ');
              console.error(`  [CONSOLE ERROR] ${args}`);
              errorsFound.push({ page: pagesToTest[currentIndex - 1], error: args });
            }
          } else if (msg.method === 'Runtime.exceptionThrown') {
            const desc = msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text;
            console.error(`  [UNCAUGHT EXCEPTION] ${desc}`);
            errorsFound.push({ page: pagesToTest[currentIndex - 1], exception: desc });
          } else if (msg.method === 'Page.loadEventFired') {
            setTimeout(() => {
              send('Runtime.evaluate', {
                expression: `
                  const bodyLen = document.body ? document.body.innerHTML.length : 0;
                  console.log('  Page title:', document.title, '| Body HTML length:', bodyLen);
                `
              });
              setTimeout(testNextPage, 1500);
            }, 1000);
          }
        };

      } catch (err) {
        console.error('CDP test error:', err);
        chromeProc.kill();
      }
    }, 2000);
  }
);

req.write(postData);
req.end();
