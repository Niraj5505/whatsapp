import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { initSocket, disconnectSocket } from '../services/socket';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem('nexaflow_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [workspace, setWorkspace] = useState(() => {
    const saved = localStorage.getItem('nexaflow_workspace');
    return saved ? JSON.parse(saved) : null;
  });
  const [workspaces, setWorkspaces] = useState([]);
  const [token, setToken] = useState(() => localStorage.getItem('nexaflow_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMe = async () => {
      if (token) {
        try {
          const res = await api.get('/auth/me');
          const userData = res.data.data.user;
          const activeWs = res.data.data.workspace;
          const wsList = res.data.data.workspaces || [];

          setUser(userData);
          setWorkspace(activeWs);
          setWorkspaces(wsList);

          localStorage.setItem('nexaflow_user', JSON.stringify(userData));
          if (activeWs) {
            localStorage.setItem('nexaflow_workspace', JSON.stringify(activeWs));
          }
          initSocket(token);
        } catch (error) {
          logout();
        }
      }
      setLoading(false);
    };

    fetchMe();
  }, [token]);

  const login = async (email, password) => {
    const res = await api.post('/auth/login', { email, password });
    const { user: loggedInUser, token: authToken, workspace: activeWs, workspaces: wsList } = res.data.data;

    localStorage.setItem('nexaflow_token', authToken);
    localStorage.setItem('nexaflow_user', JSON.stringify(loggedInUser));
    if (activeWs) {
      localStorage.setItem('nexaflow_workspace', JSON.stringify(activeWs));
    }

    setToken(authToken);
    setUser(loggedInUser);
    setWorkspace(activeWs);
    setWorkspaces(wsList || []);
    initSocket(authToken);
    return loggedInUser;
  };

  const register = async (name, email, password, workspaceName) => {
    const res = await api.post('/auth/register', { name, email, password, workspaceName });
    const { user: registeredUser, token: authToken, workspace: activeWs, workspaces: wsList } = res.data.data;

    localStorage.setItem('nexaflow_token', authToken);
    localStorage.setItem('nexaflow_user', JSON.stringify(registeredUser));
    if (activeWs) {
      localStorage.setItem('nexaflow_workspace', JSON.stringify(activeWs));
    }

    setToken(authToken);
    setUser(registeredUser);
    setWorkspace(activeWs);
    setWorkspaces(wsList || []);
    initSocket(authToken);
    return registeredUser;
  };

  const logout = async () => {
    try {
      if (token) {
        await api.post('/auth/logout');
      }
    } catch (e) {
      // Ignore network errors during logout
    } finally {
      localStorage.removeItem('nexaflow_token');
      localStorage.removeItem('nexaflow_user');
      localStorage.removeItem('nexaflow_workspace');
      setToken(null);
      setUser(null);
      setWorkspace(null);
      setWorkspaces([]);
      disconnectSocket();
    }
  };

  const switchWorkspace = (targetWorkspace) => {
    setWorkspace(targetWorkspace);
    localStorage.setItem('nexaflow_workspace', JSON.stringify(targetWorkspace));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        workspace,
        workspaces,
        token,
        loading,
        login,
        register,
        logout,
        switchWorkspace,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
