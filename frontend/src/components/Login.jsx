import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import './Login.css';

function Login() {
  const [user_name, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isUsernameValid, setIsUsernameValid] = useState(false);
  const [isPasswordValid, setIsPasswordValid] = useState(false);
  const navigate = useNavigate();

  // ✅ FIXED: Use environment variable for API URL
  const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';

  useEffect(() => {
    setIsUsernameValid(user_name.length >= 3);
  }, [user_name]);

  useEffect(() => {
    setIsPasswordValid(password.length >= 6);
  }, [password]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setMessage('');

    try {
      // ✅ FIXED: Use API_URL variable and correct field names
      const res = await axios.post(`${API_URL}/api/login`, {
        username: user_name,  // ✅ Backend expects 'username', not 'user_name'
        password
      });

      console.log("Login Response:", res.data);

      if (res.data.success) {
        const userData = res.data.user;

        // ✅ Store correct key
        sessionStorage.setItem('user', JSON.stringify(userData));

        setMessage(res.data.message || 'Login successful!');

        setTimeout(() => {
          if (userData.type === 'admin') {  // ✅ Backend returns 'type', not 'user_type'
            navigate('/admin-dashboard');
          } else {
            navigate('/user-dashboard/');
          }
        }, 1000);
      } else {
        setMessage(res.data.message || 'Login failed');
      }
    } catch (err) {
      console.error('Login Error:', err);
      const errorMessage = err.response?.data?.message || 'Login failed. Please check your credentials.';
      setMessage(errorMessage);
    } finally {
      setTimeout(() => {
        setIsLoading(false);
      }, 800);
    }
  };

  return (
    <div className="login-container">
      <div className="bg-shape"></div>
      <div className="bg-shape"></div>
      <div className="bg-shape"></div>

      <div className="login-header">
        <div className="logo-section">
          <div className="logo-icon"></div>
          <div className="brand-text">GCMS</div>
        </div>
        <div className="brand-subtitle">Gated Community Management System</div>
      </div>

      <div className="login-box">
        <h2>Welcome Back</h2>
        <p className="welcome-subtitle">Sign in to access your community portal</p>

        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label htmlFor="username">Username</label>
            <input
              id="username"
              type="text"
              placeholder="Enter your username"
              value={user_name}
              onChange={(e) => setUsername(e.target.value)}
              required
              disabled={isLoading}
            />
            {isUsernameValid && <span className="input-validation">✓</span>}
          </div>

          <div className="input-group">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={isLoading}
            />
            {isPasswordValid && <span className="input-validation">✓</span>}
          </div>

          <button
            type="submit"
            disabled={isLoading || !isUsernameValid || !isPasswordValid}
            className={isLoading ? 'loading' : ''}
          >
            {isLoading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {message && (
          <div className={`message ${message.toLowerCase().includes('success') ? 'success' : 'error'}`}>
            {message}
          </div>
        )}

        <p className="register-footer">
          Don't have an account? <a href="/register">Create one here</a>
        </p>

        <div className="security-badge" title="Secure Login">
          <svg width="16" height="16" viewBox="0 0 24 24">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M9 12l2 2 4-4" />
          </svg>
        </div>
      </div>

      {/* ✅ Debug info - remove in production */}
      {process.env.NODE_ENV === 'development' && (
        <div style={{ position: 'fixed', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.8)', color: 'white', padding: '5px', fontSize: '12px' }}>
          API URL: {API_URL}
        </div>
      )}
    </div>
  );
}

export default Login;