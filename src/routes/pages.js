const express = require('express');
const path = require('path');
const fs = require('fs-extra');

const router = express.Router();

router.get('/', (req, res) => {
  
  const indexPath = path.join(__dirname, '../../public/index.html');
  let html = fs.readFileSync(indexPath, 'utf8');
  
  // Inject user info into HTML
  if (req.session && req.session.authenticated) {
    const userInfo = `
      <div class="user-info">
        <p>Welcome, ${req.session.userEmail}!</p>
        <a href="/logout" class="logout-btn">Logout</a>
      </div>
    `;
    html = html.replace('<div class="nav-actions" id="navActions">', `<div class="nav-actions" id="navActions">${userInfo}`);
  } else {
    const loginInfo = `
      <div class="login-required">
        <p>Please login to use the translator</p>
        <a href="/login" class="login-btn">Login</a>
      </div>
    `;
    html = html.replace('<section class="upload-section">', `<div class="login-info-wrapper">${loginInfo}</div><section class="upload-section" style="display:none;">`);
  }
  
  res.send(html);
});

// Login page
router.get('/login', (req, res) => {
  if (req.session && req.session.authenticated) {
    return res.redirect('/');
  }
  
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Login - Excel AI Translator</title>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
        <style>
            body { 
                font-family: 'Inter', Arial, sans-serif; 
                max-width: 400px; 
                margin: 50px auto; 
                padding: 20px; 
                background: #f8fafc;
                color: #1e293b;
            }
            .form-group { 
                margin-bottom: 20px; 
            }
            label { 
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px; 
                font-weight: 500;
                color: #374151;
            }
            input { 
                width: 100%; 
                padding: 12px 16px; 
                box-sizing: border-box; 
                border: 2px solid #e5e7eb;
                border-radius: 8px;
                font-size: 16px;
                transition: border-color 0.2s ease;
                background: white;
            }
            input:focus {
                outline: none;
                border-color: #4f46e5;
                box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.1);
            }
            .password-input-container {
                position: relative;
                display: flex;
                align-items: center;
            }
            .password-toggle {
                position: absolute;
                right: 12px;
                background: none;
                border: none;
                color: #6b7280;
                cursor: pointer;
                padding: 8px;
                border-radius: 4px;
                transition: color 0.2s ease;
                width: auto;
            }
            .password-toggle:hover {
                color: #4f46e5;
                background: rgba(79, 70, 229, 0.05);
            }
            .login-submit-btn { 
                width: 100%; 
                padding: 12px 20px; 
                background: linear-gradient(135deg, #4f46e5, #06b6d4);
                color: white; 
                border: none; 
                border-radius: 8px;
                cursor: pointer; 
                font-weight: 600;
                font-size: 16px;
                transition: all 0.2s ease;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            .login-submit-btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            }
            .error { 
                color: #ef4444; 
                background: #fef2f2;
                padding: 12px;
                border-radius: 8px;
                border: 1px solid #fecaca;
                margin-top: 16px;
                font-size: 14px;
            }
            h2 {
                text-align: center;
                color: #1e293b;
                margin-bottom: 32px;
                font-weight: 700;
            }
        </style>
    </head>
    <body>
        <h2>Admin Login</h2>
        <form id="loginForm">
            <div class="form-group">
                <label><i class="fas fa-envelope"></i> Email:</label>
                <input type="email" id="email" required>
            </div>
            <div class="form-group">
                <label><i class="fas fa-lock"></i> Password:</label>
                <div class="password-input-container">
                    <input type="password" id="password" required>
                    <button type="button" class="password-toggle" onclick="togglePassword()">
                        <i class="fas fa-eye"></i>
                    </button>
                </div>
            </div>
            <button type="submit" class="login-submit-btn">
                <i class="fas fa-sign-in-alt"></i> Login
            </button>
        </form>
        <div id="loginError" class="error" style="display: none;"></div>
        
        <script>
            function togglePassword() {
                const input = document.getElementById('password');
                const icon = document.querySelector('.password-toggle i');
                
                if (input.type === 'password') {
                    input.type = 'text';
                    icon.classList.remove('fa-eye');
                    icon.classList.add('fa-eye-slash');
                } else {
                    input.type = 'password';
                    icon.classList.remove('fa-eye-slash');
                    icon.classList.add('fa-eye');
                }
            }
            
            document.getElementById('loginForm').addEventListener('submit', async (e) => {
                e.preventDefault();
                
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                const errorDiv = document.getElementById('loginError');
                
                try {
                    // Clear previous errors
                    errorDiv.style.display = 'none';
                    errorDiv.textContent = '';
                    
                    const response = await fetch('/api/auth/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ email, password })
                    });
                    
                    const result = await response.json();
                    
                    if (result.success) {
                        console.log('✅ Login successful, redirecting to home...');
                        setTimeout(() => {
                            window.location.href = '/';
                        }, 100);
                    } else {
                        errorDiv.textContent = result.message || 'Login failed. Please try again.';
                        errorDiv.style.display = 'block';
                    }
                } catch (error) {
                    errorDiv.textContent = 'Connection error. Please check your internet and try again.';
                    errorDiv.style.display = 'block';
                }
            });
        </script>
    </body>
    </html>
  `);
});

// Logout endpoint
router.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Session destroy error:', err);
    }
    res.redirect('/');
  });
});

module.exports = router;