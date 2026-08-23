// eTRAMS Login Page
const API_BASE = '';

const form = document.getElementById('login-form');
const usernameInput = document.getElementById('login-username');
const passwordInput = document.getElementById('login-password');
const errorBox = document.getElementById('login-error');
const submitBtn = document.getElementById('btn-login');

// Verify if session is truly active on the server before skipping login page.
if (sessionStorage.getItem('etrams_user')) {
  fetch(`${API_BASE}/api/auth/me`)
    .then((res) => {
      if (res.ok) {
        window.location.href = '/index.html';
      } else {
        sessionStorage.removeItem('etrams_user');
      }
    })
    .catch(() => {
      // Server error or offline — clear stale session and stay on login
      sessionStorage.removeItem('etrams_user');
    });
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove('hidden');
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errorBox.classList.add('hidden');

  const username = usernameInput.value.trim();
  const password = passwordInput.value;
  if (!username || !password) {
    showError('Please enter your username and password.');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.textContent = 'Signing in...';
  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error || 'Login failed. Please try again.');
      return;
    }
    sessionStorage.setItem('etrams_user', JSON.stringify(data));
    window.location.href = '/index.html';
  } catch (err) {
    showError('Cannot reach the server. Please try again.');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Sign In';
  }
});
